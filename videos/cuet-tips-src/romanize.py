"""Romanise the Whisper (Hindi) words into Hinglish caption text.

Whisper large-v3 hears "CUET" as "CUT" and mishears a few names; those are fixed here too.
"""
import json
import sys

R = {
    "अगर": "agar", "अब": "ab", "तक": "tak", "के": "ke", "आपके": "aapke", "काम": "kaam", "आ": "aa", "रहे": "rahe",
    "हैं": "hain", "तो": "toh", "में": "mein", "लिखो": "likho", "आपका": "aapka", "और": "aur", "वाला": "wala",
    "या": "ya", "अगले": "agle", "वीडियो": "video", "मैं": "main", "कुछ": "kuch", "उठाओंगा": "uthaunga", "उनकी": "unki",
    "बनाओंगा": "banaunga", "आप": "aap", "दे": "de", "हो": "ho", "को": "ko", "कर": "kar", "लो": "lo", "सब": "sab",
    "यहीं": "yahin", "चलिए": "chaliye", "पे": "pe", "बनी": "bani", "उसको": "usko", "लगाते": "lagate", "बाद": "baad",
    "पास": "paas", "एक": "ek", "असली": "asli", "होगा": "hoga", "भरनी": "bharni", "होगी": "hogi", "यहाँ": "yahan",
    "गलती": "galti", "भी": "bhi", "पूरी": "poori", "मेहनत": "mehnat", "पानी": "paani", "भेड": "pher", "सकती": "sakti",
    "है": "hai", "करते": "karte", "नहीं": "nahi", "आपको": "aapko", "प्लस": "plus", "चुनना": "chunna", "छटा": "chhatha",
    "बट": "but", "ज़ादा": "zyada", "तर": "tar", "लोग": "log", "इग्नोर": "ignore", "ऐसे": "aise", "कट": "cut", "ऑफ": "off",
    "कॉलेज": "college", "का": "ka", "होता": "hota", "देखो": "dekho", "ना": "na", "ही": "hi", "जैसे": "jaise",
    "हिंदु": "Hindu", "इसके": "iske", "अंदर": "andar", "जो": "jo", "था": "tha", "वह": "woh", "वही": "wahi",
    "लगभग": "lagbhag", "फर्क": "farak", "इसमें": "isme", "लिखना": "likhna", "काफी": "kaafi", "हर": "har",
    "होना": "hona", "चाहिए": "chahiye", "पहले": "pehle", "करो": "karo", "फिर": "phir", "क्योंकि": "kyunki", "वो": "woh",
    "पसंद": "pasand", "तीन": "teen", "साल": "saal", "बहुत": "bahut", "लंबा": "lamba", "लगेंगे": "lagenge",
    "बाहर": "bahar", "दुनिया": "duniya", "सात्वा": "saatva", "टिप": "tip", "जादातर": "zyadatar", "लिए": "liye",
    "मतलब": "matlab", "सिर्फ": "sirf", "पर": "par", "की": "ki", "ये": "ye", "से": "se", "देती": "deti",
    "खराब": "kharab", "टिर": "tier", "बोलके": "bolke", "हलके": "halke", "ले": "le", "लेते": "lete", "यही": "yahi",
    "बचाता": "bachata", "कहते": "kehte", "अजमेर": "Ajmer", "पूरा": "poora", "सब्जेक्स": "subjects",
    "ध्यान": "dhyan", "रखने": "rakhne", "वाली": "wali", "बात": "baat", "लिस्ट": "list", "अपने": "apne",
    "स्टेट": "state", "जरूर": "zaroor", "रखो": "rakho", "लेती": "leti", "स्कोर": "score", "फीस": "fees",
    "प्लेस्मेंट": "placement", "खुद": "khud", "चेक": "check", "करना": "karna", "रहेगा": "padega", "नमबर": "number",
    "नाइन": "nine", "युनिवर्सिटी": "university", "अलग": "alag", "दर्वाजा": "darwaza", "बच्चों": "bachchon",
    "किसी": "kisi", "सीट": "seat", "लेके": "leke", "जा": "ja", "देना": "dena", "स्टेप": "step", "बन": "one",
    "टू": "two", "अपना": "apna", "पोर्टल": "portal", "ड्यू": "DU", "राज": "Raj", "दूसरी": "doosri",
    "अपनी": "apni", "वेबसाइट": "website", "होती": "hoti",
    "आपने": "aapne", "किया": "kiya", "इस": "is", "आओगे": "aaoge", "चाहे": "chahe", "कितना": "kitna", "अच्छा": "achha",
    "क्यों": "kyun", "साथ": "saath", "उसकी": "uski", "बार": "baar", "दो": "do", "बनती": "banti", "मेरा": "mera",
    "दसवा": "dasvan", "आखरी": "aakhri", "बना": "bana", "भूलने": "bhoolne", "चीज": "cheez", "चीज़": "cheez",
    "पहला": "pehla", "अभी": "abhi", "जब": "jab", "दूसर": "doosra", "भड़ते": "bharte", "आते": "aate",
    "बनाओ": "banao", "दोबारा": "dobara", "शायद": "shayad", "गया": "gaya", "उल्टा": "ulta", "दोनों": "dono",
    "बीच": "beech", "महीने": "mahine", "रहो": "raho", "थे": "the", "मेरे": "mere", "मैंने": "maine", "शुरू": "shuru",
    "कहा": "kaha", "सबसे": "sabse", "जिस": "jis", "कम": "kam", "देते": "dete", "लिस्ट": "list", "बनाने": "banane",
    "बताये": "bataye", "मत": "mat", "हिसाब": "hisaab", "सारा": "saara", "वर्थ": "paas", "भरूसा": "bharosa",
    "यूज़": "use", "करने": "karne", "हमारी": "hamari", "इन": "in", "कोई": "koi", "आज": "aaj", "लगा": "laga",
    "सकते": "sakte", "याद": "yaad", "रखना": "rakhna", "नाम": "naam", "चांस": "chance", "क्योंकि": "kyunki",
}
FIX = {"CUT": "CUET", "Jammu-Millia-Islamia": "Jamia", "be": "BA", "BTEC": "B.Tech", "बांदर": "Bandarsindri",
       "सीन्ग्री": "", "everything": "Everything", "CVT": "CUET", "tears": "tiers", "rails": "reels",
       "code": "case", "crowd": "crowd", "वड़ावट": "", "ह": ""}

words = json.load(open(sys.argv[1]))
out, missing = [], set()
for w in words:
    t = w["text"]
    core = t.rstrip(".,?!")
    tail = t[len(core):]
    if core in FIX:
        r = FIX[core]
    elif core in R:
        r = R[core]
    elif core.isascii():
        r = core
    else:
        missing.add(core)
        r = core
    if r:
        out.append({"text": r + tail, "start": w["start"], "end": w["end"]})
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
print("missing:", sorted(missing))
