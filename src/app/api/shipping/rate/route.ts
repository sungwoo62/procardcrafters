import { NextRequest, NextResponse } from "next/server";

const FEDEX_API_BASE =
  process.env.FEDEX_ENV === "production"
    ? "https://apis.fedex.com"
    : "https://apis-sandbox.fedex.com";

// 프로덕션 Procardcrafters 발송 주소
const SHIPPER_ADDRESS = {
  streetLines: ["123 Print Ave"],
  city: "Los Angeles",
  stateOrProvinceCode: "CA",
  postalCode: "90001",
  countryCode: "US",
};

async function getFedExToken(): Promise<string> {
  const res = await fetch(`${FEDEX_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.FEDEX_API_KEY!,
      client_secret: process.env.FEDEX_SECRET_KEY!,
    }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`FedEx 토큰 획득 실패: ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

export interface ShippingRateResult {
  serviceType: string;
  serviceName: string;
  transitDays: number | null;
  deliveryDate: string | null;
  totalNetCharge: number;
  currency: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      recipientPostalCode,
      recipientStateCode = "",
      recipientCity = "",
      recipientCountryCode = "US",
      weightLbs = 1,
    } = await req.json();

    if (!recipientPostalCode) {
      return NextResponse.json(
        { error: "수령인 우편번호가 필요합니다." },
        { status: 400 }
      );
    }

    const missingKeys = [
      !process.env.FEDEX_API_KEY && "FEDEX_API_KEY",
      !process.env.FEDEX_SECRET_KEY && "FEDEX_SECRET_KEY",
      !process.env.FEDEX_ACCOUNT_NUMBER && "FEDEX_ACCOUNT_NUMBER",
    ].filter(Boolean);

    if (missingKeys.length > 0) {
      return NextResponse.json(
        { error: `FedEx 환경변수가 설정되지 않았습니다: ${missingKeys.join(", ")}` },
        { status: 503 }
      );
    }

    const token = await getFedExToken();

    const rateRequest = {
      accountNumber: { value: process.env.FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        shipper: { address: SHIPPER_ADDRESS },
        recipient: {
          address: {
            city: recipientCity,
            stateOrProvinceCode: recipientStateCode,
            postalCode: recipientPostalCode,
            countryCode: recipientCountryCode,
            residential: true,
          },
        },
        pickupType: "DROPOFF_AT_FEDEX_LOCATION",
        rateRequestType: ["ACCOUNT", "LIST"],
        requestedPackageLineItems: [
          {
            weight: { units: "LB", value: Math.max(0.1, Number(weightLbs)) },
            dimensions: { length: 12, width: 9, height: 1, units: "IN" },
          },
        ],
      },
    };

    const rateRes = await fetch(`${FEDEX_API_BASE}/rate/v1/rates/quotes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-locale": "en_US",
      },
      body: JSON.stringify(rateRequest),
    });

    if (!rateRes.ok) {
      const err = await rateRes.text();
      return NextResponse.json(
        { error: "FedEx 운임 조회 실패", detail: err },
        { status: 502 }
      );
    }

    const rateData = await rateRes.json();
    const rateReplyDetails = rateData.output?.rateReplyDetails ?? [];

    const rates: ShippingRateResult[] = rateReplyDetails.map(
      (detail: Record<string, unknown>) => {
        const shipmentDetails = (
          detail.ratedShipmentDetails as Record<string, unknown>[] | undefined
        )?.[0];
        const commit = detail.commit as Record<string, unknown> | undefined;
        const dateDetail = commit?.dateDetail as
          | Record<string, unknown>
          | undefined;

        return {
          serviceType: detail.serviceType as string,
          serviceName: detail.serviceName as string,
          transitDays: (commit?.transitDays as number | null) ?? null,
          deliveryDate: (dateDetail?.dayFormat as string | null) ?? null,
          totalNetCharge: Number(
            (shipmentDetails?.totalNetCharge as string | number | null) ?? 0
          ),
          currency:
            (shipmentDetails?.currency as string | null) ?? "USD",
        };
      }
    );

    return NextResponse.json({ rates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
