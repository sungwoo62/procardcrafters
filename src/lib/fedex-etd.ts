// FedEx ETD (Electronic Trade Documents) 업로드
//
// OMO-2371 — 통관 신속 처리 레시피
// Docs: https://developer.fedex.com/api/en-us/catalog/upload-documents/docs.html
//
// 두 가지 시나리오를 모두 지원한다.
//
// 시나리오 1 — 발송 전 업로드 (ETDPreshipment)
//   ① uploadEtdDocument({ workflow: 'PRESHIPMENT', file, referenceId })
//      → docID 수령
//   ② Ship API requestedShipment.shipmentSpecialServices 에 다음 포함:
//        specialServiceTypes: ['ELECTRONIC_TRADE_DOCUMENTS']
//        etdDetail.attachedDocuments: [{ documentType, documentId, ... }]
//      ⇒ buildShipPreshipmentAttachment() 가 적절한 구조 생성
//
// 시나리오 2 — 발송 후 업로드 (ETDPostshipment)
//   ① Ship API 호출 시 shipmentSpecialServices.etdDetail.requestedDocumentTypes 지정
//      ⇒ buildShipPostshipmentEtdDetail() 가 적절한 구조 생성
//   ② 발송물 생성 응답에서 masterTrackingNumber 수령
//   ③ uploadEtdDocument({ workflow: 'POSTSHIPMENT', file, trackingNumber, ... })
//
// 환경 변수
//   FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET / FEDEX_ACCOUNT_NUMBER  — 운영 (Rate/Ship 와 동일)
//   FEDEX_DOC_API_BASE         — (선택) 기본 https://documentapi.prod.fedex.com
//   FEDEX_SANDBOX_DOC_API_BASE — (선택) 기본 https://documentapitest.prod.fedex.com/sandbox
//
// 인증은 Rate/Ship 과 동일한 OAuth 토큰을 그대로 재사용한다.

import type { Buffer } from 'node:buffer'

export type EtdWorkflow = 'PRESHIPMENT' | 'POSTSHIPMENT'

export type EtdDocumentType =
  | 'COMMERCIAL_INVOICE'
  | 'PRO_FORMA_INVOICE'
  | 'CERTIFICATE_OF_ORIGIN'
  | 'NAFTA_CERTIFICATE_OF_ORIGIN'
  | 'CUSTOMS_DECLARATION'
  | 'PACKING_LIST'
  | 'OTHER'

export interface EtdUploadInput {
  workflow: EtdWorkflow
  file: Buffer
  fileName: string                      // 'commercial_invoice.pdf'
  referenceId: string                   // 우리 측 식별자 — 추후 attachedDocuments 매칭에 사용
  contentType?: string                  // default: 'application/pdf'
  /** POSTSHIPMENT 인 경우 필수 */
  trackingNumber?: string
  /** POSTSHIPMENT 인 경우 권장 */
  documentType?: EtdDocumentType
  /** 운영/샌드박스 토글. true = sandbox base URL 사용 */
  sandbox?: boolean
  /** OAuth access_token. 호출자가 직접 제공 (Rate/Ship 헬퍼에서 캐시된 토큰 재사용) */
  accessToken: string
}

export interface EtdUploadStatus {
  status: string        // 'SUCCESS' | 'FAILED'
  documentId?: string   // ← 시나리오 1 에서 Ship 호출에 사용할 docID
  referenceId?: string
  errors?: { code: string; message: string }[]
}

export interface EtdUploadResult {
  documentStatuses: EtdUploadStatus[]
  meta?: {
    workflowName?: string
    documentType?: string
    carrierCode?: string
    uploadDate?: string
  }
  raw: unknown
}

function getDocBase(sandbox: boolean): string {
  if (sandbox) {
    return process.env.FEDEX_SANDBOX_DOC_API_BASE ?? 'https://documentapitest.prod.fedex.com/sandbox'
  }
  return process.env.FEDEX_DOC_API_BASE ?? 'https://documentapi.prod.fedex.com'
}

/**
 * Upload Multiple Documents (lhsuploaddocument) — multipart/form-data.
 *
 * Part 1 ('attributes')  : application/json 메타데이터
 * Part 2 ('document')    : binary file (PDF 등)
 *
 * 응답의 documentStatuses[].documentId 가 시나리오 1 에서 Ship 호출에 사용된다.
 */
export async function uploadEtdDocument(input: EtdUploadInput): Promise<EtdUploadResult> {
  const {
    workflow, file, fileName, referenceId,
    contentType = 'application/pdf',
    trackingNumber, documentType,
    sandbox = false, accessToken,
  } = input

  if (workflow === 'POSTSHIPMENT' && !trackingNumber) {
    throw new Error('uploadEtdDocument: trackingNumber required for POSTSHIPMENT workflow')
  }

  const attributes: Record<string, unknown> = {
    document: {
      referenceId,
      name: fileName,
      contentType,
      meta: { imageType: 'PDF', imageIndex: 'IMAGE_1' },
    },
    rules: {
      workflowName: workflow === 'PRESHIPMENT' ? 'ETDPreshipment' : 'ETDPostshipment',
    },
  }

  if (workflow === 'POSTSHIPMENT') {
    attributes.shipmentDocumentInfo = {
      trackingNumber,
      ...(documentType ? { documentType } : {}),
    }
  }

  // FedEx 가 multipart 파트명을 정확히 'attributes' 와 'document' 로 기대한다.
  const form = new FormData()
  form.append('attributes', new Blob([JSON.stringify(attributes)], { type: 'application/json' }))
  // Buffer → ArrayBuffer (Blob 생성용)
  const ab = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
  form.append('document', new Blob([ab], { type: contentType }), fileName)

  const url = `${getDocBase(sandbox)}/documents/v1/lhsuploaddocument`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-locale': 'en_US',
      // Content-Type 은 fetch 가 boundary 포함해 자동 설정
    },
    body: form,
  })

  const text = await res.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 1000) } }

  if (!res.ok) {
    throw new Error(`FedEx ETD upload failed: ${res.status} ${text.slice(0, 500)}`)
  }

  const d = data as {
    output?: { documentStatuses?: EtdUploadStatus[]; meta?: EtdUploadResult['meta'] }
    documentStatuses?: EtdUploadStatus[]
    meta?: EtdUploadResult['meta']
  }
  return {
    documentStatuses: d.output?.documentStatuses ?? d.documentStatuses ?? [],
    meta: d.output?.meta ?? d.meta,
    raw: data,
  }
}

/**
 * 시나리오 1 — Ship API 페이로드의 shipmentSpecialServices 블록.
 * 사전 업로드된 docID 를 발송물에 연결한다.
 */
export interface AttachedEtdDocument {
  documentType: EtdDocumentType   // 'COMMERCIAL_INVOICE'
  documentId: string              // uploadEtdDocument() 응답의 documentId
  documentReference?: string      // 호출자 측 referenceId 와 동일하게
  description?: string            // 'Commercial Invoice'
  fileName?: string
}

export function buildShipPreshipmentAttachment(documents: AttachedEtdDocument[]) {
  return {
    specialServiceTypes: ['ELECTRONIC_TRADE_DOCUMENTS'],
    etdDetail: {
      attachedDocuments: documents.map((d) => ({
        documentType: d.documentType,
        documentReference: d.documentReference ?? d.documentType,
        description: d.description ?? d.documentType.replace(/_/g, ' ').toLowerCase(),
        documentId: d.documentId,
        ...(d.fileName ? { fileName: d.fileName } : {}),
      })),
    },
  }
}

/**
 * 시나리오 2 — Ship API 페이로드의 shipmentSpecialServices 블록.
 * 발송 생성 시점에는 어떤 문서 타입을 사후 업로드할지만 선언.
 */
export function buildShipPostshipmentEtdDetail(documentTypes: EtdDocumentType[]) {
  return {
    specialServiceTypes: ['ELECTRONIC_TRADE_DOCUMENTS'],
    etdDetail: {
      requestedDocumentTypes: documentTypes,
    },
  }
}

/**
 * 경로 A — FedEx 자동 생성 Commercial Invoice (운영 기본값, OMO-2371 보드 결정).
 *
 * Ship API requestedShipment 에 spread 로 합쳐서 사용:
 *
 *   const shipBody = {
 *     ...,
 *     requestedShipment: {
 *       ...commonShipment,
 *       ...buildAutoInvoiceEtd(),
 *     },
 *   }
 *
 * FedEx 가 customs commodities 데이터로 invoice PDF 를 자동 렌더링하여
 * 발송물에 ETD 로 첨부한다. 응답 transactionShipments[].shipmentDocuments[]
 * 에 `{ contentType: 'COMMERCIAL_INVOICE', encodedLabel: <base64 PDF> }` 포함.
 *
 * 별도 Upload Documents API 구독이 필요 없는 가장 저마찰 경로.
 * 우리 PDF 양식이 필요할 시점에 buildShipPreshipmentAttachment() 로 전환.
 */
export function buildAutoInvoiceEtd(): {
  shipmentSpecialServices: { specialServiceTypes: string[]; etdDetail: { requestedDocumentTypes: string[] } }
  shippingDocumentSpecification: {
    shippingDocumentTypes: string[]
    commercialInvoiceDetail: { documentFormat: { stockType: string; docType: string } }
  }
} {
  return {
    shipmentSpecialServices: buildShipPostshipmentEtdDetail(['COMMERCIAL_INVOICE']),
    shippingDocumentSpecification: {
      shippingDocumentTypes: ['COMMERCIAL_INVOICE'],
      commercialInvoiceDetail: {
        documentFormat: { stockType: 'PAPER_LETTER', docType: 'PDF' },
      },
    },
  }
}
