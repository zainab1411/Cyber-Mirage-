# Cyber-Mirage-ملفات الـ Honeypot
from collections import Counter
import json
from datetime import datetime, timezone
from elasticsearch import Elasticsearch
import pandas as pd

# 1. الاتصال بقاعدة بيانات Elasticsearch الخاصة بـ T-Pot
# استبدل العنوان ورقم المنفذ وكلمات المرور بما يناسب بيئتك الفعلية
ES_HOST = "https://your-tpot-ip:9200"
ES_USER = "elastic"
ES_PASSWORD = "your_password"

try:
    client = Elasticsearch(
        ES_HOST,
        basic_auth=(ES_USER, ES_PASSWORD),
        verify_certs=False,  # تُعدل حسب شهادات الأمان لديك
    )
    print("[+] Connected to Elasticsearch successfully.")
except Exception as e:
    print(f"[-] Connection failed: {e}")
    exit(1)


# 2. سحب السجلات (Logs) الخاصة بالهجمات
def fetch_honeypot_logs(index_pattern="logstash-*", size=10000):
    query = {"query": {"match_all": {}}, "size": size}
    response = client.search(body=query, index=index_pattern)
    hits = response["hits"]["hits"]

    logs = []
    for hit in hits:
        source = hit["_source"]
        logs.append(
            {
                "timestamp": source.get("@timestamp"),
                "src_ip": source.get("src_ip"),  # حقل الـ IP (حسب هيكلة T-Pot لديك)
                "username": source.get("username"),  # اسم المستخدم المستخدم في محاولات الاختراق
                "password": source.get("password"),  # كلمة المرور المستخدمة
                "honeypot": source.get("sensor"),  # اسم الهونيبوت المستهدف (مثل Cowrie, Dionaea)
            }
        )
    return pd.DataFrame(logs)


# 3. تحليل السلوك واستخراج المؤشرات الأمنية (Behavioral Analysis)
def analyze_behavior(df):
    print("\n" + "=" * 50)
    print("       تقرير تحليل السلوك والهجمات السيبرانية       ")
    print("=" * 50)

    # أ) أكثر عناوين IP تكراراً في محاولات الهجوم
    top_ips = df["src_ip"].value_counts().head(10)
    print("\n[+] أكثر عناوين IP تكراراً في محاولات الهجوم:")
    print(top_ips)

    # ب) أكثر أسماء المستخدمين (Usernames) استهدافاً
    top_users = df["username"].value_counts().head(10)
    print("\n[+] أكثر أسماء المستخدمين استخداماً في محاولات الدخول:")
    print(top_users)

    # ج) حساب إحصائيات عامة لكل هونيبوت
    attack_counts = df["honeypot"].value_counts()
    print("\n[+] عدد الهجمات لكل نوع هونيبوت (Sensor):")
    print(attack_counts)

    return top_ips, top_users, attack_counts


# 4. تحويل النتائج إلى ملخص يتوافق مع results.json الخاص بالداشبورد
def build_results_summary(df, top_ips, top_users, attack_counts):
    summary = {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total_attacks": int(len(df)),
        "top_ips": [
            {"ip": ip, "count": int(count)} for ip, count in top_ips.items()
        ],
        "top_usernames": [
            {"username": user, "count": int(count)} for user, count in top_users.items()
        ],
        "attacks_by_honeypot": [
            {"honeypot": hp, "count": int(count)} for hp, count in attack_counts.items()
        ],
    }
    return summary


# تنفيذ البايبلاين البرمجي
if __name__ == "__main__":
    df_logs = fetch_honeypot_logs()
    if not df_logs.empty:
        top_ips, top_users, attack_counts = analyze_behavior(df_logs)

        results_summary = build_results_summary(df_logs, top_ips, top_users, attack_counts)

        # حفظ الملخص بصيغة تتوافق مع results.json الخاص بلوحة التحكم
        with open("results.json", "w", encoding="utf-8") as f:
            json.dump(results_summary, f, ensure_ascii=False, indent=4)

        print("\n[+] تم حفظ ملخص النتائج بنجاح في ملف 'results.json' (متوافق مع الداشبورد).")
    else:
        print("[-] لم يتم العثور على سجلات مطابقة.")