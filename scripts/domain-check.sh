#!/usr/bin/env bash
# فحص جاهزية الدومين (DNS + HTTPS + إعادة التوجيه). يُشغَّل في GitHub Actions لأن الشبكة هناك مفتوحة.
# لا يغيّر أي شيء. كل سطر: OK أو WAIT (لم يجهز بعد) مع السبب.
D="${1:-dabbir.online}"
ok() { echo "OK    $*"; }; wait_() { echo "WAIT  $*"; }
A=$(dig +short A "$D" | sort | tr '\n' ' ')
[ "$A" = "185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153 " ] && ok "A $D → GitHub Pages" || wait_ "A $D = '${A:-none}' (المطلوب 185.199.108-111.153)"
AAAA=$(dig +short AAAA "$D" | sort | tr '\n' ' ')
echo "$AAAA" | grep -q "2606:50c0:8000::153" && ok "AAAA $D → GitHub Pages" || wait_ "AAAA $D = '${AAAA:-none}'"
W=$(dig +short CNAME "www.$D")
[ "$W" = "azoxj.github.io." ] && ok "CNAME www.$D → azoxj.github.io" || wait_ "CNAME www.$D = '${W:-none}'"
CAA=$(dig +short CAA "$D"); [ -z "$CAA" ] || echo "$CAA" | grep -q letsencrypt && ok "CAA يسمح بـ Let's Encrypt (${CAA:-لا يوجد CAA})" || wait_ "CAA يمنع Let's Encrypt: $CAA"
CODE=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "https://$D/")
[ "$CODE" = "200" ] && ok "https://$D/ → 200" || wait_ "https://$D/ → $CODE"
CERT=$(echo | timeout 15 openssl s_client -servername "$D" -connect "$D:443" 2>/dev/null | openssl x509 -noout -subject -issuer -enddate 2>/dev/null | tr '\n' ' ')
echo "$CERT" | grep -qi "$D" && ok "الشهادة: $CERT" || wait_ "الشهادة: ${CERT:-لا توجد شهادة بعد}"
R=$(curl -s -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "http://$D/")
echo "$R" | grep -q "https://$D/" && ok "http → https ($R)" || wait_ "http → https: $R"
WW=$(curl -s -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "https://www.$D/")
echo "$WW" | grep -q "https://$D/" && ok "www → $D ($WW)" || wait_ "www → $D: $WW"
O=$(curl -s -o /dev/null -m 20 -w '%{http_code} %{redirect_url}' "https://azoxj.github.io/dabbir/budget")
echo "$O" | grep -q "$D" && ok "الرابط القديم يحوّل للدومين ($O)" || wait_ "الرابط القديم: $O (يبقى يعمل حتى ربط الدومين)"
grep -q "class=\"\|<div id=\"root\"" <(curl -s -m 20 "https://$D/budget") && ok "تحديث صفحة داخلية (404.html fallback)" || wait_ "صفحة داخلية لم تُخدم بعد"
exit 0
