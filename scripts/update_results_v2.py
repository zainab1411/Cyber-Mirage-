import json
import pandas as pd

# مسار ملف الـ CSV اللي صدّرته سمية من Kibana (Discover -> Export CSV)
CSV_PATH = "Untitled Discover session(1).csv"

# عتبة عدد المحاولات اللي لو تجاوزها أي IP يطلع تنبيه بالداشبورد
HIGH_ACTIVITY_THRESHOLD = 10


def main():
    df_raw = pd.read_csv(CSV_PATH)

    df = pd.DataFrame({
        "ip": df_raw.get("src_ip"),
        "username": df_raw.get("username"),
        "time": df_raw.get("@timestamp"),
        "country": df_raw.get("geoip.country_name"),
    })
    df = df.replace("-", pd.NA)

    # 1. total_attempts: إجمالي عدد السجلات
    total_attempts = int(len(df))

    # 2. top_ip: الـ IP الأكثر تكراراً
    ip_counts = df["ip"].dropna().value_counts()
    top_ip = str(ip_counts.index[0]) if not ip_counts.empty else ""

    # 3. high_activity_alert: صحيح لو أعلى IP تجاوز العتبة
    high_activity_alert = bool(
        not ip_counts.empty and ip_counts.iloc[0] >= HIGH_ACTIVITY_THRESHOLD
    )

    # 4. attempts: كل محاولة كـ IP + username + time (للجدول بالداشبورد)
    attempts_df = df.dropna(subset=["ip"])
    attempts = [
        {
            "ip": str(row["ip"]),
            "username": str(row["username"]) if pd.notna(row["username"]) else "-",
            "time": str(row["time"]),
        }
        for _, row in attempts_df.iterrows()
    ]

    # 5. attacks_by_country: نسب الدول (حقل إضافي جديد لرسم الدول)
    total_country = int(df["country"].dropna().shape[0])
    country_counts = df["country"].dropna().value_counts().head(10)
    attacks_by_country = [
        {
            "country": country,
            "count": int(count),
            "percentage": round(count / total_country * 100, 1),
        }
        for country, count in country_counts.items()
    ]

    results = {
        "total_attempts": total_attempts,
        "top_ip": top_ip,
        "high_activity_alert": high_activity_alert,
        "attempts": attempts,
        "attacks_by_country": attacks_by_country,
    }

    with open("../data/results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"[+] total_attempts: {total_attempts}")
    print(f"[+] top_ip: {top_ip}")
    print(f"[+] high_activity_alert: {high_activity_alert}")
    print(f"[+] عدد الدول: {len(attacks_by_country)}")
    print("[+] تم حفظ results.json بنجاح")


if __name__ == "__main__":
    main()