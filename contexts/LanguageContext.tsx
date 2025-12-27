import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'ru' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const DICTIONARY = {
  ru: {
    // Nav & Sidebar
    home: 'Главная',
    trending: 'В тренде',
    new: 'Новое',
    shorts: 'Shorts',
    categories: 'Категории',
    models: 'Модели',
    favorites: 'Избранное',
    history: 'История',
    live_cam: 'LIVE CAM',
    premium: 'PREMIUM',
    subscriptions: 'Подписки',
    
    // UI Elements
    search_placeholder: 'Поиск видео...',
    back: 'Назад',
    views: 'просмотров',
    subscribe: 'Подписаться',
    subscribed: 'Вы подписаны',
    comments: 'Комментарии',
    tip: 'Поддержать',
    share: 'Поделиться',
    privacy_on: 'Приватность ВКЛ',
    privacy_off: 'Приватность ВЫКЛ',
    loading: 'Загрузка...',
    loading_suggestions: 'Загрузка рекомендаций...',
    admin: 'Админка',
    ad: 'Реклама',
    sponsor: 'Спонсор',
    
    // AI Curator
    ai_concierge: 'AI Консьерж',
    ai_desc: 'Подбор видео по настроению, фантазии или ситуации...',
    velvet_intel: 'Velvet Intelligence',
    mood_prompt: 'Какое настроение сегодня?',
    mood_desc: 'Опишите желаемую атмосферу, темп или сценарий. ИИ создаст персональную подборку.',
    prompt_placeholder: 'Например: Хочу что-то медленное и романтичное с красивой музыкой...',
    analyzing: 'Анализ предпочтений...',
    safe_search: 'Безопасный поиск',
    smart_tags: 'Smart Tags',
    pick_for_me: 'Подобрать',

    // Video Player
    category_label: 'Категория:',
    want_more: 'Хотите больше?',
    premium_promo: 'Полные версии сцен без цензуры в Premium',
    try_free: 'Попробовать бесплатно',
    
    // Sections
    recommended: 'Рекомендовано вам',
    curated: 'Подборка AI',
    popular_today: 'Популярное сегодня',
    view_all: 'Смотреть все',
    
    // Empty States
    no_favorites: 'В избранном пока пусто. Добавляйте видео, нажимая на сердце.',
    no_history: 'История просмотров пуста.',
    
    // Auth / Gate
    age_verification: 'Вход только для взрослых',
    age_warning_title: 'ВНИМАНИЕ: Сайт содержит материалы 18+',
    age_warning_text: 'Этот веб-сайт содержит материалы откровенного сексуального характера. Входя на сайт, вы подтверждаете, что вам исполнилось 18 лет (или больше, если возраст совершеннолетия в вашей юрисдикции выше), и вы согласны просматривать такой контент.',
    enter_site: 'Мне есть 18 лет — Войти',
    exit_site: 'Мне нет 18 лет — Выйти',
    
    // Footer & Legal
    footer_disclaimer: 'Все лица, изображенные в визуальных материалах откровенного сексуального характера на этом сайте, были старше 18 лет на момент создания изображения. 18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement.',
    terms_of_use: 'Условия использования',
    privacy_policy: 'Политика конфиденциальности',
    compliance_2257: '2257 Compliance',
    dmca_policy: 'DMCA / Авторские права',
    report_abuse: 'Сообщить о нарушении',
    cookie_notice: 'Мы используем cookie для улучшения работы сайта.',
    rights_reserved: 'Все права защищены.',
    parental_control: 'Родительский контроль: Используйте RTA или ASACP для блокировки этого сайта.',

    // Admin
    admin_dashboard: 'Панель администратора',
    content_management: 'Управление контентом и аналитика',
    settings: 'Настройки',
    add_new: 'Добавить',
    fetched_videos: 'Получено видео',
    active_creators: 'Активные авторы',
    connected_sources: 'Источники',
    system_status: 'Статус системы',
    online: 'Онлайн',
    videos: 'Видео',
    creators: 'Авторы',
    search_content: 'Поиск контента через API...',
    all_sources: 'Все источники',
    thumbnail: 'Превью',
    title: 'Название',
    source: 'Источник',
    duration: 'Длительность',
    actions: 'Действия',
    
    // Ratings
    velvet_charts: 'Рейтинги Velvet',
    top_ratings: 'Топ рейтинги',
    global_top: 'Топ 100 (Мир)',
    rising_stars: 'Восходящие звезды',
    live_data: 'Рейтинг обновляется каждые 24 часа (Live Data)',

    // Moods
    mood_romantic: 'Романтика',
    mood_romantic_desc: 'Мягкий фокус, эмоции',
    mood_intense: 'Интенсив',
    mood_intense_desc: 'Грубо, высокий контраст',
    mood_story: 'Сюжет',
    mood_story_desc: 'История, нуар, тайна',
    mood_educational: 'Обучение',
    mood_educational_desc: 'Техника и познание',
    mood_cinematic: 'Кино',
    mood_cinematic_desc: '4K визуал, искусство',
    mood_all: 'Все',

    // Footer Static
    footer_intermediary: 'Velvet действует как посредник и не производит контент. У нас нулевая терпимость к незаконному контенту.',
    badge_rta: 'RTA | Только для взрослых',
    badge_asacp: 'ASACP | Участник',
    badge_compliance: '18 U.S.C. 2257',
    badge_dmca: 'DMCA Compliant',

    // Legal Modal
    legal_center: 'Юридический центр',
    compliance_safety: 'Соответствие и безопасность',
    terms_tab: 'Условия',
    compliance_tab: '2257',
    dmca_tab: 'DMCA',
    privacy_tab: 'Конфиденциальность',
    close: 'Закрыть',
    
    // Guided Session
    gso_anatomy_title: 'Твоя Анатомия',
    gso_partner_title: 'Выбери Партнера',
    gso_kinks_title: 'Твои Интересы',
    gso_sync_title: 'Синхронизация',
    gso_btn_him: 'Для Него',
    gso_btn_her: 'Для Неё',
    gso_btn_back: 'Назад',
    gso_btn_next: 'Далее',
    gso_btn_start: 'НАЧАТЬ СЕССИЮ',
    gso_btn_cancel: 'Отмена',
    gso_motion_sync: 'Motion Sync',
    gso_motion_desc: 'Я буду чувствовать твои движения',
    gso_audio: 'Звуки / Стоны',
    gso_media_abstract: 'Абстракция',
    gso_media_video: 'Видео',
    gso_controlling: 'контролирует...',
    gso_finish: 'ЗАКОНЧИТЬ',
    gso_climax: 'Я БЛИЗКО / КОНЧАЮ!',
    gso_summary_title: 'Сессия завершена',
    gso_menu: 'В МЕНЮ',
    gso_sync_hint: 'Включи датчики для полного погружения.',
    gso_relax: 'Relax',
    gso_edge: 'Edge',
    gso_limit: 'Limit',
    gso_ruin: 'RUIN IT!',
    gso_cum_now: 'CUM NOW',
    gso_enjoy: 'НАСЛАЖДАЙСЯ',
    gso_finish_action: 'ФИНИШ',
    gso_release: 'RELEASE',
    gso_good_boy: 'GOOD BOY',
    gso_faster: 'FASTER',
    gso_together: 'ВМЕСТЕ',
    gso_keep_pace: 'KEEP PACE',
    gso_move: 'MOVE',
    gso_work: 'WORK',
    gso_stop_breath: 'СТОП. ДЫШИ.',
    gso_slow_down: 'ЗАМЕДЛИСЬ',
    gso_hands_off: 'РУКИ ПРОЧЬ',
    gso_pause: 'PAUSE',
    gso_harder: 'ЖЕСТЧЕ',
    gso_rhythm: 'РИТМ',
    gso_continue: 'ПРОДОЛЖАЙ',
    gso_accelerate: 'УСКОРЯЙСЯ',
    gso_slowly: 'МЕДЛЕННО',
    gso_stroke: 'ГЛАДЬ',
    gso_start: 'START',
    gso_wait: 'WAIT',
    gso_calculating: '...',
    
    // Kinks
    kink_praise: 'Похвала',
    kink_humiliation: 'Унижение',
    kink_rough: 'Грубо',
    kink_sensual: 'Чувственно',
    kink_joi: 'Инструкции (JOI)',

    // Personas
    persona_mistress_desc: 'Строгая, властная, контроль.',
    persona_gfe_desc: 'Нежная, романтичная, похвала.',
    persona_brat_desc: 'Дерзкая, дразнит, провоцирует.',
    persona_coach_desc: 'Техничная, без эмоций, фокус.',
    
    // Legal Content
    terms_title: 'Условия использования и возрастные ограничения',
    terms_warning: 'ВНИМАНИЕ: Этот сайт содержит материалы откровенного сексуального характера. Вам должно быть не менее 18 лет.',
    terms_affirm: 'Входя на сайт, вы подтверждаете, что:',
    terms_age: 'Вам исполнилось 18 лет (или больше в вашей юрисдикции).',
    terms_legal: 'Просмотр таких материалов легален в вашем регионе.',
    terms_vol: 'Вы заходите добровольно.',
    terms_minors: 'Вы не покажете этот контент несовершеннолетним.',
    compliance_title: 'Соответствие 18 U.S.C. § 2257',
    compliance_text: 'Velvet полностью соблюдает 18 U.S.C. § 2257. Всем моделям на момент съемки было не менее 18 лет.',
    custodian: 'Хранитель записей',
    dmca_title: 'DMCA и Авторские права',
    dmca_text: 'Velvet уважает авторские права. Если вы считаете, что ваши права нарушены, отправьте уведомление.',
    zero_tolerance: 'Политика нулевой терпимости:',
    zero_tolerance_text: 'Мы немедленно удаляем любой незаконный контент и сообщаем о нем властям.',
    privacy_title: 'Политика конфиденциальности',
    privacy_text: 'Мы уважаем вашу приватность и не продаем данные третьим лицам.',
    data_collection: 'Сбор данных',
    data_text: 'Мы можем собирать анонимные данные (IP, браузер) для улучшения работы сайта.',
    cookies: 'Cookies',
    cookies_text: 'Сайт использует cookie для запоминания возраста и настроек.',
    
    // Boss Mode
    boss_title: 'Финансовая Аналитика Q3',
    last_updated: 'Обновлено: Сегодня, 14:02',
    boss_user: 'Польз: Админ',
    export_csv: 'Экспорт CSV',
    metric: 'Метрика',
    visualization_loading: 'Загрузка визуализации данных...',
    boss_return: 'Нажмите любую клавишу или кликните для возврата.',

    // Age Gate & Misc
    redirecting: 'Перенаправление...',
    terms_short: 'Условия',
    privacy_short: 'Приватность',
    view_profile: 'Профиль',
    videos_label: 'Видео',
    
    // Badges & Misc
    premium_tag: 'PREMIUM',
    exclusive_tier: 'Exclusive',
    standard_tier: 'Standard',
    ad_label: 'РЕКЛАМА',
    external_source: 'Внешний',
    
    // User Modes
    mode_general: 'Общий / Гетеро',
    mode_him: 'Для него',
    mode_her: 'Для неё',
    mode_couples: 'Для пар',
    mode_gay: 'Гей',
    mode_trans: 'Транс',
    mode_lesbian: 'Лесби',

    // Sidebar Static
    velvet_touch: 'Velvet Touch',
    interactive: 'Интерактив',
    charts: 'Чарты',
  },
  en: {
    // Nav & Sidebar
    home: 'Home',
    trending: 'Trending',
    new: 'New',
    shorts: 'Shorts',
    categories: 'Categories',
    models: 'Models',
    favorites: 'Favorites',
    history: 'History',
    live_cam: 'LIVE CAM',
    premium: 'PREMIUM',
    subscriptions: 'Subscriptions',
    
    // UI Elements
    search_placeholder: 'Search videos...',
    back: 'Back',
    views: 'views',
    subscribe: 'Subscribe',
    subscribed: 'Subscribed',
    comments: 'Comments',
    tip: 'Tip',
    share: 'Share',
    privacy_on: 'Privacy ON',
    privacy_off: 'Privacy OFF',
    loading: 'Loading...',
    loading_suggestions: 'Loading suggestions...',
    admin: 'Admin',
    ad: 'Ad',
    sponsor: 'Sponsor',

    // AI Curator
    ai_concierge: 'AI Concierge',
    ai_desc: 'Video selection by mood, fantasy, or scenario...',
    velvet_intel: 'Velvet Intelligence',
    mood_prompt: 'What is your mood today?',
    mood_desc: 'Describe the desired atmosphere, pace, or scenario. AI will create a personal selection.',
    prompt_placeholder: 'E.g.: I want something slow and romantic with beautiful music...',
    analyzing: 'Analyzing preferences...',
    safe_search: 'Safe Search',
    smart_tags: 'Smart Tags',
    pick_for_me: 'Curate',

    // Video Player
    category_label: 'Category:',
    want_more: 'Want more?',
    premium_promo: 'Get uncensored full scenes in Premium',
    try_free: 'Try Free',
    
    // Sections
    recommended: 'Recommended for you',
    curated: 'AI Curated',
    popular_today: 'Popular Today',
    view_all: 'View All',
    
    // Empty States
    no_favorites: 'No favorites yet. Click the heart icon to add videos.',
    no_history: 'Watch history is empty.',
    
    // Auth / Gate
    age_verification: 'Adults Only',
    age_warning_title: 'WARNING: This site contains 18+ content',
    age_warning_text: 'This website contains explicit sexual material. By entering, you affirm that you are at least 18 years of age (or the age of majority in your jurisdiction) and consent to viewing such content.',
    enter_site: 'I am 18+ — Enter',
    exit_site: 'I am under 18 — Exit',

    // Footer & Legal
    footer_disclaimer: 'All persons depicted in visual depictions of explicit sexual conduct on this website were 18 years of age or older at the time of creation. 18 U.S.C. 2257 Record-Keeping Requirements Compliance Statement.',
    terms_of_use: 'Terms of Use',
    privacy_policy: 'Privacy Policy',
    compliance_2257: '2257 Compliance',
    dmca_policy: 'DMCA Policy',
    report_abuse: 'Report Content',
    cookie_notice: 'This site uses cookies to ensure the best experience.',
    rights_reserved: 'All rights reserved.',
    parental_control: 'Parental Control: Please use RTA or ASACP filters to block this site.',

    // Admin
    admin_dashboard: 'Admin Dashboard',
    content_management: 'Content Management & Analytics',
    settings: 'Settings',
    add_new: 'Add New',
    fetched_videos: 'Fetched Videos',
    active_creators: 'Active Creators',
    connected_sources: 'Connected Sources',
    system_status: 'System Status',
    online: 'Online',
    videos: 'Videos',
    creators: 'Creators',
    search_content: 'Search content via API...',
    all_sources: 'All Sources',
    thumbnail: 'Thumbnail',
    title: 'Title',
    source: 'Source',
    duration: 'Duration',
    actions: 'Actions',

    // Ratings
    velvet_charts: 'Velvet Charts',
    top_ratings: 'Top Ratings',
    global_top: 'Global Top 100',
    rising_stars: 'Rising Stars',
    live_data: 'Ratings update every 24h (Live Data)',

    // Moods
    mood_romantic: 'Ethereal',
    mood_romantic_desc: 'Soft focus, emotional connection',
    mood_intense: 'Raw',
    mood_intense_desc: 'High contrast, unpolished reality',
    mood_story: 'Noir',
    mood_story_desc: 'Narrative driven, shadows & mystery',
    mood_educational: 'Guide',
    mood_educational_desc: 'Structured learning & technique',
    mood_cinematic: 'Cinema',
    mood_cinematic_desc: '4K visuals, art direction',
    mood_all: 'All',

    // Footer Static
    footer_intermediary: 'Velvet acts as an intermediary and does not produce the content displayed. We have a zero-tolerance policy against illegal content.',
    badge_rta: 'RTA | Restricted To Adults',
    badge_asacp: 'ASACP | Member',
    badge_compliance: '18 U.S.C. 2257',
    badge_dmca: 'DMCA Compliant',

    // Legal Modal
    legal_center: 'Legal Center',
    compliance_safety: 'Compliance & Safety',
    terms_tab: 'Terms of Use',
    compliance_tab: '2257 Compliance',
    dmca_tab: 'DMCA / Copyright',
    privacy_tab: 'Privacy Policy',
    close: 'Close',

    // Guided Session
    gso_anatomy_title: 'Your Anatomy',
    gso_partner_title: 'Choose Partner',
    gso_kinks_title: 'Your Interests',
    gso_sync_title: 'Synchronization',
    gso_btn_him: 'For Him',
    gso_btn_her: 'For Her',
    gso_btn_back: 'Back',
    gso_btn_next: 'Next',
    gso_btn_start: 'START SESSION',
    gso_btn_cancel: 'Cancel',
    gso_motion_sync: 'Motion Sync',
    gso_motion_desc: 'I will feel your movements',
    gso_audio: 'Sounds / Moans',
    gso_media_abstract: 'Abstract',
    gso_media_video: 'Video',
    gso_controlling: 'is controlling...',
    gso_finish: 'FINISH',
    gso_climax: 'I\'M CLOSE / CUMMING!',
    gso_summary_title: 'Session Complete',
    gso_menu: 'TO MENU',
    gso_sync_hint: 'Enable sensors for full immersion.',
    gso_relax: 'Relax',
    gso_edge: 'Edge',
    gso_limit: 'Limit',
    gso_ruin: 'RUIN IT!',
    gso_cum_now: 'CUM NOW',
    gso_enjoy: 'ENJOY',
    gso_finish_action: 'FINISH',
    gso_release: 'RELEASE',
    gso_good_boy: 'GOOD BOY',
    gso_faster: 'FASTER',
    gso_together: 'TOGETHER',
    gso_keep_pace: 'KEEP PACE',
    gso_move: 'MOVE',
    gso_work: 'WORK',
    gso_stop_breath: 'STOP. BREATHE.',
    gso_slow_down: 'SLOW DOWN',
    gso_hands_off: 'HANDS OFF',
    gso_pause: 'PAUSE',
    gso_harder: 'HARDER',
    gso_rhythm: 'RHYTHM',
    gso_continue: 'CONTINUE',
    gso_accelerate: 'FASTER',
    gso_slowly: 'SLOWLY',
    gso_stroke: 'STROKE',
    gso_start: 'START',
    gso_wait: 'WAIT',
    gso_calculating: '...',

    // Kinks
    kink_praise: 'Praise',
    kink_humiliation: 'Humiliation',
    kink_rough: 'Rough',
    kink_sensual: 'Sensual',
    kink_joi: 'Instructions (JOI)',

    // Personas
    persona_mistress_desc: 'Strict, dominant, control.',
    persona_gfe_desc: 'Gentle, romantic, praise.',
    persona_brat_desc: 'Cheeky, teasing, provocative.',
    persona_coach_desc: 'Technical, emotionless, focus.',

    // Legal Content
    terms_title: 'Terms of Use & Age Limitation',
    terms_warning: 'WARNING: This website contains sexually explicit material. You must be at least 18 years of age to enter.',
    terms_affirm: 'By entering this website, you affirm that:',
    terms_age: 'You are at least 18 years of age (or the age of majority in your jurisdiction).',
    terms_legal: 'It is legal in your community to view sexually explicit material.',
    terms_vol: 'You are accessing this site voluntarily.',
    terms_minors: 'You will not expose minors to this content.',
    compliance_title: '18 U.S.C. § 2257 Compliance',
    compliance_text: 'Velvet is fully compliant with 18 U.S.C. § 2257 and 28 C.F.R. 75. All models were at least 18 years of age at the time of creation.',
    custodian: 'Custodian of Records',
    dmca_title: 'DMCA & Intellectual Property',
    dmca_text: 'Velvet respects intellectual property rights. If you believe your work has been infringed, please submit a notice.',
    zero_tolerance: 'Zero Tolerance Policy:',
    zero_tolerance_text: 'We have a zero-tolerance policy for illegal content. Any such content will be removed immediately.',
    privacy_title: 'Privacy Policy',
    privacy_text: 'We are committed to protecting your privacy. We do not sell your personal data to third parties.',
    data_collection: 'Data Collection',
    data_text: 'We may collect anonymized data such as IP addresses and browser type to enhance your experience.',
    cookies: 'Cookies',
    cookies_text: 'This site uses cookies to remember your age verification status and language preferences.',

    // Boss Mode
    boss_title: 'Q3 Financial Analytics Dashboard',
    last_updated: 'Last updated: Today, 14:02 PM',
    boss_user: 'User: Admin',
    export_csv: 'Export CSV',
    metric: 'Metric',
    visualization_loading: 'Data Visualization Loading...',
    boss_return: 'Press any key or click to return to workspace.',

    // Age Gate & Misc
    redirecting: 'Redirecting...',
    terms_short: 'Terms',
    privacy_short: 'Privacy',
    view_profile: 'View Profile',
    videos_label: 'Videos',

    // Badges & Misc
    premium_tag: 'PREMIUM',
    exclusive_tier: 'Exclusive',
    standard_tier: 'Standard',
    ad_label: 'AD',
    external_source: 'External',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('ru');

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('velvet_lang') as Language;
    if (saved) setLang(saved);
  }, []);

  const handleSetLang = (l: Language) => {
    setLang(l);
    localStorage.setItem('velvet_lang', l);
  };

  const t = (key: string): string => {
    // @ts-ignore
    return DICTIONARY[lang][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
};