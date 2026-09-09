"""
سكربت التحديث التلقائي لمشروع Cyber Mirage
يتصل بـ Elasticsearch الخاص بـ T-Pot، يسحب بيانات هجمات Cowrie،
يحسب الإحصائيات، ويحدّث ملف data/results.json تلقائيًا.

⚠️ مهم قبل الاستخدام:
- لا تكتبي اسم المستخدم/كلمة المرور مباشرة هنا إذا بترفعين المشروع على
  GitHub (المستودع عندكم public). خزّنيهم في ملف .env بدلاً من ذلك
  وأضيفي .env إلى .gitignore.
- شغّلي أولاً find_cowrie_index() بمفردها للتأكد من اسم الـ index الصحيح
  قبل ما تفعّلين باقي السكربت، لأن اسمه يختلف حسب نسخة T-Pot عندكم.
"""

import os
import json
import time
from collections import Counter
from datetime import datetime, timezone

import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

# تحميل المتغيرات من ملف .env (لازم ينشأ بجانب هذا الملف ولا يُرفع لـ GitHub)
load_dotenv()

ES_HOST = os.getenv("ES_HOST", "https://34.239.26.173:443")
ES_USER = os.getenv("ES_USER", "")
ES_PASS = os.getenv("ES_PASS", "")

print("HOST:", ES_HOST)
print("USER:", ES_USER)
print("PASS:", "***" if ES_PASS else "EMPTY!")

# T-Pot يستخدم شهادة SSL ذاتية التوقيع، فنطفي التحقق منها (verify=False)
requests.packages.urllib3.disable_warnings()

RESULTS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "results.json")


def find_cowrie_index():
    """
    يعرض كل الـ indices الموجودة في Elasticsearch عشان تعرفين
    الاسم الصحيح لبيانات Cowrie عندكم (يختلف حسب نسخة T-Pot).
    شغّليها مرة وحدة يدويًا قبل التفعيل التلقائي.
    """
    resp = requests.get(
        f"{ES_HOST}/_cat/indices?v&format=json",
        auth=HTTPBasicAuth(ES_USER, ES_PASS),
        verify=False,
        timeout=60,
    )
    print("STATUS:", resp.status_code)
    print("CONTENT:", resp.text[:1000])

    resp.raise_for_status()
    for idx in resp.json():
        print(idx["index"])


def fetch_cowrie_events(index_pattern="logstash-*", hours=24, size=2000):
    """
    يسحب أحداث Cowrie من آخر N ساعة.
    عدّلي index_pattern حسب النتيجة اللي طلعت من find_cowrie_index().
    """
    query = {
        "size": size,
        "query": {
            "bool": {
                "must": [
                    {"match": {"type": "Cowrie"}},
                    {"range": {"@timestamp": {"gte": f"now-{hours}h"}}},
                ]
            }
        },
        "sort": [{"@timestamp": "desc"}],
    }

    resp = requests.post(
        f"{ES_HOST}/{index_pattern}/_search",
        auth=HTTPBasicAuth(ES_USER, ES_PASS),
        json=query,
        verify=False,
        timeout=30,
    )
    resp.raise_for_status()
    hits = resp.json()["hits"]["hits"]
    return [h["_source"] for h in hits]


def build_stats(events):
    """يحسب الأرقام المطلوبة من الأحداث: العدد، أكثر IP، أكثر يوزر"""
    ips = Counter(e.get("src_ip") for e in events if e.get("src_ip"))
    usernames = Counter(e.get("username") for e in events if e.get("username"))

    return {
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "total_attempts": len(events),
        "top_ips": ips.most_common(5),
        "top_usernames": usernames.most_common(5),
    }


def save_results(stats):
    os.makedirs(os.path.dirname(RESULTS_PATH), exist_ok=True)
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"[{stats['last_updated']}] تم تحديث results.json — {stats['total_attempts']} محاولة")


def run_once(index_pattern="logstash-*"):
    events = fetch_cowrie_events(index_pattern=index_pattern)
    stats = build_stats(events)
    save_results(stats)


def run_forever(index_pattern="logstash-*", interval_seconds=300):
    """يشتغل بشكل مستمر ويحدّث كل 5 دقائق (عدّلي المدة حسب حاجتكم)"""
    while True:
        try:
            run_once(index_pattern=index_pattern)
        except Exception as e:
            print("خطأ أثناء التحديث:", e)
        time.sleep(interval_seconds)


if __name__ == "__main__":
    # الخطوة 1: شغّلي هذا السطر أولاً بمفرده لمعرفة اسم الـ index الصحيح
    find_cowrie_index()

    # الخطوة 2: بعد ما تعرفين اسم الـ index، فعّلي هذا السطر
    # run_once(index_pattern="logstash-*")   # أو الاسم اللي ظهر لك

    # الخطوة 3: للتحديث التلقائي المستمر
   # run_forever(index_pattern="logstash-*", interval_seconds=300)