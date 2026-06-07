#!/usr/bin/env bash
# OMO-2557 — Google Ads 전환 태그(awct) 템플릿 채우기
# 사용법:
#   scripts/omo-2557-fill-ads-tags.sh <AW_CONVERSION_ID_숫자> <PURCHASE_LABEL> <LEAD_EMAIL_LABEL> <LEAD_CHAT_LABEL>
# 예:
#   scripts/omo-2557-fill-ads-tags.sh 123456789 AbC-D_efGh12 XyZ-1_qrSt34 LmN-2_uvWx56
#
# 출력: docs/OMO-2557-gtm-ads-tags.filled.json (GTM Merge/Overwrite import 가능)
# - conversionId 는 반드시 숫자(AW-XXXXXXXXX 에서 'AW-' 제거한 숫자부분). 비숫자면 거부.
# - 리드 라벨을 1개 통합으로 갈 경우: email/chat 라벨에 동일 값을 넣으면 됨.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TPL="$DIR/docs/OMO-2557-gtm-ads-tags.template.json"
OUT="$DIR/docs/OMO-2557-gtm-ads-tags.filled.json"

if [ "$#" -ne 4 ]; then
  echo "사용법: $0 <AW_CONVERSION_ID_숫자> <PURCHASE_LABEL> <LEAD_EMAIL_LABEL> <LEAD_CHAT_LABEL>" >&2
  exit 1
fi

CID="$1"; PURCHASE="$2"; LEAD_EMAIL="$3"; LEAD_CHAT="$4"

# 'AW-' prefix 가 실수로 들어와도 제거
CID="${CID#AW-}"
if ! [[ "$CID" =~ ^[0-9]+$ ]]; then
  echo "오류: Conversion ID 는 숫자여야 합니다 (입력: '$1'). AW-XXXXXXXXX 의 숫자부분만 넣으세요." >&2
  exit 2
fi

if [ ! -f "$TPL" ]; then
  echo "오류: 템플릿 없음: $TPL" >&2
  exit 3
fi

python3 - "$TPL" "$OUT" "$CID" "$PURCHASE" "$LEAD_EMAIL" "$LEAD_CHAT" <<'PY'
import json,sys
tpl,out,cid,purchase,lead_email,lead_chat = sys.argv[1:7]
s=open(tpl,encoding="utf-8").read()
s=(s.replace("__AW_CONVERSION_ID__",cid)
     .replace("__PURCHASE_LABEL__",purchase)
     .replace("__LEAD_EMAIL_LABEL__",lead_email)
     .replace("__LEAD_CHAT_LABEL__",lead_chat))
d=json.loads(s)            # 유효성 검증
d.pop("_comment",None)     # 안내 주석은 결과물에서 제거
# 남은 placeholder 가 없는지 확인
left=[k for k in ("__AW_CONVERSION_ID__","__PURCHASE_LABEL__","__LEAD_EMAIL_LABEL__","__LEAD_CHAT_LABEL__") if k in json.dumps(d)]
if left:
    print("오류: 미치환 placeholder:",left,file=sys.stderr); sys.exit(4)
json.dump(d,open(out,"w",encoding="utf-8"),ensure_ascii=False,indent=2)
print("생성:",out)
print("  Conversion ID :",cid)
print("  Purchase Label:",purchase)
print("  Lead(email)   :",lead_email)
print("  Lead(chat)    :",lead_chat)
PY

echo
echo "다음 단계:"
echo "  1) GTM(GTM-K3SCHZX3) → Admin → Import Container → $OUT"
echo "  2) Workspace=Existing(Default) → Merge → Overwrite conflicts"
echo "  3) Preview 로 runbook §7 검증 → Publish"
