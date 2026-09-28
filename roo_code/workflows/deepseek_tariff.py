"""Тариф DeepSeek: цены и часы пика. Только stdlib — годится и для питона aider.

api-docs.deepseek.com/quick_start/pricing, сверено 2026-09-28: пик — 01:00–04:00 и
06:00–10:00 UTC по будням, в остальные часы и в выходные цена вдвое ниже. Китайские
праздники тариф считает дешёвыми, здесь они пиковые: списка праздников нет, а ошибка
в эту сторону стоит только простоя, не денег. Всё в UTC: часы ноутбука (Europe/Vilnius)
переводятся дважды в год, и пик по местному времени съехал бы на час.

aider считает по дневному тарифу всегда и завышал счёт ночи: проба 2026-09-28 в
дешёвые часы — aider $0.294, баланс −$0.15.
"""

from datetime import datetime, timedelta, timezone

# $ за 1M токенов в пик: (из кэша, мимо кэша, выход). Модели нет в таблице — цены нет.
PRICES = {"deepseek-v4-flash": (0.006, 0.30, 1.20), "deepseek-v4-pro": (0.044, 1.32, 3.96)}
PEAK_UTC = ((1, 4), (6, 10))   # будни
# Файл режима в каталоге ночи: pause — в пик запросов к DeepSeek нет, ignore — идут.
MODE_FILE = "deepseek-peak"
MODES = ("pause", "ignore")


def utc_now():
    return datetime.now(timezone.utc)


def is_deepseek(model):
    return model.startswith("deepseek/")


def peak(moment):
    return moment.weekday() < 5 and any(start <= moment.hour < end for start, end in PEAK_UTC)


def next_change(moment):
    """Ближайший момент, когда пик начнётся или кончится."""
    moment = moment.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    state = peak(moment)
    for _ in range(24 * 8):
        moment += timedelta(hours=1)
        if peak(moment) != state:
            return moment
    raise AssertionError("тариф без смены за неделю")


def cost(model, calls):
    """Деньги по вызовам `[время UTC, отправлено, из кэша, выход]`; None — посчитать нечем."""
    prices = PRICES.get(model.split("/")[-1])
    if prices is None:
        return None
    hit_price, miss_price, out_price = prices
    total = 0.0
    for at, sent, hit, out in calls:
        share = 1.0 if peak(datetime.fromisoformat(at)) else 0.5
        total += share * (hit * hit_price + (sent - hit) * miss_price + out * out_price) / 1e6
    return round(total, 6)


def read_mode(path):
    """Режим из файла ночи. Файла нет — не ночь (ручной прогон, проба): паузы нет.
    Непонятное содержимое — пауза: это дешевле, а ошибку видно в статусе."""
    try:
        text = path.read_text().strip()
    except (OSError, AttributeError):
        return "ignore"
    return text if text in MODES else "pause"
