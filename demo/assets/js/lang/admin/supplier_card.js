console.log("Flexiron: Supplier Card Dictionary Loading...");

if (typeof window.translations === 'undefined') { 
    window.translations = { ru: {}, en: {}, lt: {} }; 
}

/* Supplier Profile (04.1) Translations */

// --- RU ---
window.translations.ru.supplier = {
    card_title: "Профиль поставщика"
};

window.translations.ru.page = {
    seo: {
        title: "Flexiron — Профиль поставщика",
        description: "Flexiron"
    },
    header_title: "Профиль поставщика"
};

window.translations.ru.sp = {
    status_title: "Жизненный цикл и статус",
    status_label: "Текущий статус",
    rating_label: "Рейтинг надежности",
    status_reason: "Причина статуса / Комментарий",
    status_placeholder: "Добавьте детали статуса или внутренние заметки...",
    contract_date: "Дата контракта",
    requisites: "Реквизиты компании",
    name: "Название компании",
    vat: "Код НДС",
    address: "Юридический адрес",
    contact: "Основное контактное лицо",
    contact_name: "ФИО",
    contact_email: "Эл. почта",
    contact_phone: "Телефон",
    procurement: "Закупки и логистика",
    spec: "Специализация (категории металла)",
    spec_placeholder: "Выберите категорию...",
    bcc: "BCC Price Emails",
    bcc_placeholder: "добавить@email.com",
    currency: "Базовая валюта",
    payment: "Условия оплаты",
    lead: "Срок доставки (сред. дней)",
    lead_hint: "Среднее время от заказа до поступления товара на склад.",
    min: "Мин. сумма заказа",
    notes_title: "Внутренние заметки и история",
    notes_placeholder: "Напишите обновление по этому поставщику...",
    pricing_hist: "История цен и заказов",
    req_hist: "История BCC запросов",
    files_title: "Вложения и контракты",
    dropzone_hint: "Перетащите документы сюда<br>(Контракты, Прайс-листы, Сертификаты)",
    audit: "Полная история аудита (Entity Log)",
    new_req: "Новый Запрос...",
    sel_source: "Выбрать Источник",
    sel_status: "Выбрать Статус",
    sel_product: "Выбрать Товар"
};

window.translations.ru.st = {
    active: "Активен",
    preferred: "Приоритетный",
    new: "Новый",
    review: "На проверке",
    suspended: "Приостановлен",
    draft: "Черновик",
    expired: "Контракт истек",
    blocked: "Заблокирован",
    replied: "Отвечено",
    pending: "В ожидании"
};

window.translations.ru.btn = {
    bcc_tool: "BCC Помощник",
    config_card: "Настроить карточку",
    save: "Сохранить изменения",
    add_note: "Добавить заметку",
    add_entry: "Добавить запись",
    add_log: "Добавить лог",
    download: "Скачать",
    delete: "Удалить"
};

window.translations.ru.opt = {
    bcc_tool: "BCC Помощник",
    email: "Эл. почта",
    phone: "Телефон",
    messenger: "Мессенджер",
    other: "Другое"
};

window.translations.ru.th = {
    date: "Дата",
    product: "Товар",
    stock: "Запас",
    price: "€/кг",
    request: "Запрос",
    source: "Источник",
    status: "Статус",
    timestamp: "Время",
    user: "Пользователь",
    prop: "Измененное поле",
    diff: "Сравнение (Старое → Новое)"
};

window.translations.ru.msg = {
    save_success: "Изменения успешно сохранены!"
};

window.translations.ru.date = {
    months: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
    weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
};

// --- EN ---
window.translations.en.supplier = {
    card_title: "Supplier Profile"
};

window.translations.en.page = {
    seo: {
        title: "Flexiron — Supplier Profile",
        description: "Flexiron"
    },
    header_title: "Supplier Profile"
};

window.translations.en.sp = {
    status_title: "Lifecycle & Status",
    status_label: "Current Status",
    rating_label: "Reliability Rating",
    status_reason: "Status Reason / Comment",
    status_placeholder: "Add status details or internal comments...",
    contract_date: "Contract Date",
    requisites: "Company Requisites",
    name: "Company Name",
    vat: "VAT Code",
    address: "Physical Address",
    contact: "Main Contact Person",
    contact_name: "Full Name",
    contact_email: "Email",
    contact_phone: "Phone",
    procurement: "Procurement & Logistics",
    spec: "Specialization (Metal Categories)",
    spec_placeholder: "Select category...",
    bcc: "BCC Price Emails",
    bcc_placeholder: "add@email.com",
    currency: "Base Currency",
    payment: "Payment Terms",
    lead: "Lead Time (Avg. Days)",
    lead_hint: "Average time from order to goods receipt at the warehouse.",
    min: "Min. Order Value",
    notes_title: "Internal Notes & History",
    notes_placeholder: "Write a new update about this supplier...",
    pricing_hist: "Pricing & Order History",
    req_hist: "BCC Request Logs",
    files_title: "Attachments & Contracts",
    dropzone_hint: "Drag & Drop Documents<br>(Contracts, Price Lists, Certificates)",
    audit: "Full Audit History (Entity Log)",
    new_req: "New Request...",
    sel_source: "Select Source",
    sel_status: "Select Status",
    sel_product: "Select Product"
};

window.translations.en.st = {
    active: "Active",
    preferred: "Preferred",
    new: "New",
    review: "Under Review",
    suspended: "Suspended",
    draft: "Draft",
    expired: "Contract Expired",
    blocked: "Blocked",
    replied: "Replied",
    pending: "Pending"
};

window.translations.en.btn = {
    bcc_tool: "BCC Request Tool",
    config_card: "Configure Card",
    save: "Save Changes",
    add_note: "Add Note",
    add_entry: "Add Entry",
    add_log: "Add Log",
    download: "Download",
    delete: "Delete"
};

window.translations.en.opt = {
    bcc_tool: "BCC Tool",
    email: "Email",
    phone: "Phone",
    messenger: "Messenger",
    other: "Other"
};

window.translations.en.th = {
    date: "Date",
    product: "Product",
    stock: "Stock",
    price: "€/kg",
    request: "Request",
    source: "Source",
    status: "Status",
    timestamp: "Timestamp",
    user: "User",
    prop: "Property Changed",
    diff: "Comparison (Old → New)"
};

window.translations.en.msg = {
    save_success: "Changes saved successfully!"
};

window.translations.en.date = {
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    weekdays: ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
};

// --- LT ---
window.translations.lt.supplier = {
    card_title: "Tiekėjo profilis"
};

window.translations.lt.page = {
    seo: {
        title: "Flexiron — Tiekėjo profilis",
        description: "Flexiron"
    },
    header_title: "Tiekėjo profilis"
};

window.translations.lt.sp = {
    status_title: "Gyvavimo ciklas ir būsena",
    status_label: "Dabartinė būsena",
    rating_label: "Patikimumo reitingas",
    status_reason: "Būsenos priežastis / Komentaras",
    status_placeholder: "Pridėkite būsenos detales arba vidinius komentarus...",
    contract_date: "Sutarties data",
    requisites: "Įmonės rekvizitai",
    name: "Įmonės pavadinimas",
    vat: "PVM kodas",
    address: "Fizinis adresas",
    contact: "Pagrindinis kontaktinis asmuo",
    contact_name: "Vardas, Pavardė",
    contact_email: "El. paštas",
    contact_phone: "Telefonas",
    procurement: "Pirkimai ir logistika",
    spec: "Specializacija (metalo kategorijos)",
    spec_placeholder: "Pasirinkite kategoriją...",
    bcc: "BCC kainų el. laiškai",
    bcc_placeholder: "pridėti@pastas.lt",
    currency: "Bazinė valiuta",
    payment: "Mokėjimo sąlygos",
    lead: "Pristatymo terminas (vid. dienų)",
    lead_hint: "Vidutinis laikas nuo užsakymo iki prekių gavimo į sandėlį.",
    min: "Min. užsakymo vertė",
    notes_title: "Vidinės pastabos и istorija",
    notes_placeholder: "Parašykite naują atnaujinimą apie šį tiekėją...",
    pricing_hist: "Kainų и užsakymų istorija",
    req_hist: "BCC užklausų žurnalai",
    files_title: "Priedai ir sutartys",
    dropzone_hint: "Vilkite dokumentus čia<br>(Sutartys, kainoraščiai, sertifikatai)",
    audit: "Visa audito istorija (Entity Log)",
    new_req: "Nauja Užklausa...",
    sel_source: "Pasirinkti Šaltinį",
    sel_status: "Pasirinkti Statusą",
    sel_product: "Pasirinkti Produktą"
};

window.translations.lt.st = {
    active: "Aktyvus",
    preferred: "Prioritetinis",
    new: "Naujas",
    review: "Peržiūrimas",
    suspended: "Sustabdytas",
    draft: "Juodraštis",
    expired: "Sutartis pasibaigusi",
    blocked: "Užblokuotas",
    replied: "Atsakyta",
    pending: "Laukiama"
};

window.translations.lt.btn = {
    bcc_tool: "BCC užklausų įrankis",
    config_card: "Konfigūruoti kortelę",
    save: "Išsaugoti pakeitimus",
    add_note: "Pridėti pastabą",
    add_entry: "Pridėti įrašą",
    add_log: "Pridėti žurnalą",
    download: "Atsisiųsti",
    delete: "Ištrinti"
};

window.translations.lt.opt = {
    bcc_tool: "BCC Įrankis",
    email: "El. paštas",
    phone: "Telefonas",
    messenger: "Messenger",
    other: "Kita"
};

window.translations.lt.th = {
    date: "Data",
    product: "Produktas",
    stock: "Atsargos",
    price: "€/kg",
    request: "Užklausa",
    source: "Šaltinis",
    status: "Statusas",
    timestamp: "Laikas",
    user: "Vartotojas",
    prop: "Pakeistas laukas",
    diff: "Palyginimas (Senas → Naujas)"
};

window.translations.lt.msg = {
    save_success: "Pakeitimai sėkmingai išsaugoti!"
};

window.translations.lt.date = {
    months: ["Sausis", "Vasaris", "Kovas", "Balandis", "Gegužė", "Birželis", "Liepa", "Rugpjūtis", "Rugsėjis", "Spalis", "Lapkritis", "Gruodis"],
    weekdays: ["Pr", "An", "Tr", "Kt", "Pn", "Še", "Se"]
};

console.log("Flexiron: Supplier Card Dictionary Loaded.");
