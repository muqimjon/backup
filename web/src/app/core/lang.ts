import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type Locale = 'en' | 'ru' | 'uz';

type Dict = Record<string, string>;

const EN: Dict = {
  'nav.dashboard': 'Dashboard', 'nav.sources': 'Sources', 'nav.destinations': 'Destinations',
  'nav.jobs': 'Jobs', 'nav.history': 'History', 'nav.agents': 'Agents', 'nav.settings': 'Settings',
  'app.signOut': 'Sign out', 'app.theme': 'Theme', 'app.language': 'Language',
  'btn.add': 'Add', 'btn.save': 'Save', 'btn.cancel': 'Cancel', 'btn.delete': 'Delete',
  'btn.edit': 'Edit', 'btn.refresh': 'Refresh', 'btn.remove': 'Remove', 'btn.connect': 'Connect',
  'btn.runNow': 'Run now', 'btn.test': 'Test', 'btn.drill': 'Drill', 'btn.versions': 'Versions',
  'btn.link': 'Link', 'btn.sendTest': 'Send test',
  'dash.title': 'Dashboard', 'dash.subtitle': 'Overview of your backups',
  'sources.title': 'Sources', 'sources.subtitle': 'Databases and buckets to back up', 'sources.add': '+ Add source',
  'dest.title': 'Destinations', 'dest.subtitle': 'Where backups are uploaded — powered by rclone (70+ clouds)', 'dest.add': '+ Add destination',
  'jobs.title': 'Jobs', 'jobs.subtitle': 'A source + destination on a schedule', 'jobs.add': '+ Add job',
  'history.title': 'History', 'history.subtitle': 'Every backup, upload, drill and restore',
  'agents.title': 'Agents', 'agents.subtitle': 'Worker containers that run your backups',
  'settings.title': 'Notifications', 'settings.subtitle': 'Use your own SMTP and Telegram bot — nothing is shared, secrets are encrypted.',
  'notify.on': 'Notify on', 'notify.failure': 'Failures only', 'notify.always': 'Every run', 'notify.never': 'Never',
  'f.name': 'Name', 'f.type': 'Type', 'f.host': 'Host', 'f.port': 'Port', 'f.engine': 'Engine',
  'f.username': 'Username', 'f.password': 'Password', 'f.target': 'Database / Bucket', 'f.path': 'Path',
  'f.status': 'Status', 'f.size': 'Size', 'f.started': 'Started', 'f.message': 'Message', 'f.job': 'Job',
  'f.source': 'Source', 'f.destination': 'Destination', 'f.lastSeen': 'Last seen', 'f.version': 'Version',
  'f.project': 'Project', 'f.schedule': 'Schedule', 'f.agent': 'Agent', 'f.retention': 'Retention',
  'empty.sources': 'No sources yet. Add a database or bucket to back up.',
  'empty.destinations': 'No destinations yet. Add a cloud or server to upload backups to.',
  'empty.jobs': 'No jobs yet. A job ties a source to a destination and runs it on a schedule.',
  'empty.history': 'No runs recorded yet.', 'empty.agents': 'No agents registered yet.',
  'empty.versions': 'No versions yet. Run a backup first — they appear here (local and cloud).',
  'm.addSource': 'Add source', 'm.addDestination': 'Add destination', 'm.addJob': 'Add job', 'm.editJob': 'Edit job',
  'loadMore': 'Load more', 'connected': 'Connected destinations', 'recentRuns': 'Recent runs',
};

const RU: Dict = {
  'nav.dashboard': 'Панель', 'nav.sources': 'Источники', 'nav.destinations': 'Назначения',
  'nav.jobs': 'Задачи', 'nav.history': 'История', 'nav.agents': 'Агенты', 'nav.settings': 'Настройки',
  'app.signOut': 'Выйти', 'app.theme': 'Тема', 'app.language': 'Язык',
  'btn.add': 'Добавить', 'btn.save': 'Сохранить', 'btn.cancel': 'Отмена', 'btn.delete': 'Удалить',
  'btn.edit': 'Изменить', 'btn.refresh': 'Обновить', 'btn.remove': 'Убрать', 'btn.connect': 'Подключить',
  'btn.runNow': 'Запустить', 'btn.test': 'Тест', 'btn.drill': 'Проверка', 'btn.versions': 'Версии',
  'btn.link': 'Привязать', 'btn.sendTest': 'Тест',
  'dash.title': 'Панель', 'dash.subtitle': 'Обзор ваших резервных копий',
  'sources.title': 'Источники', 'sources.subtitle': 'Базы данных и хранилища для копирования', 'sources.add': '+ Добавить источник',
  'dest.title': 'Назначения', 'dest.subtitle': 'Куда загружаются копии — на базе rclone (70+ облаков)', 'dest.add': '+ Добавить назначение',
  'jobs.title': 'Задачи', 'jobs.subtitle': 'Источник + назначение по расписанию', 'jobs.add': '+ Добавить задачу',
  'history.title': 'История', 'history.subtitle': 'Все копии, загрузки, проверки и восстановления',
  'agents.title': 'Агенты', 'agents.subtitle': 'Рабочие контейнеры, выполняющие копии',
  'settings.title': 'Уведомления', 'settings.subtitle': 'Используйте свой SMTP и Telegram-бот — ничего не передаётся, секреты шифруются.',
  'notify.on': 'Уведомлять', 'notify.failure': 'Только при сбоях', 'notify.always': 'Каждый запуск', 'notify.never': 'Никогда',
  'f.name': 'Название', 'f.type': 'Тип', 'f.host': 'Хост', 'f.port': 'Порт', 'f.engine': 'СУБД',
  'f.username': 'Пользователь', 'f.password': 'Пароль', 'f.target': 'База / Бакет', 'f.path': 'Путь',
  'f.status': 'Статус', 'f.size': 'Размер', 'f.started': 'Начато', 'f.message': 'Сообщение', 'f.job': 'Задача',
  'f.source': 'Источник', 'f.destination': 'Назначение', 'f.lastSeen': 'Был(а)', 'f.version': 'Версия',
  'f.project': 'Проект', 'f.schedule': 'Расписание', 'f.agent': 'Агент', 'f.retention': 'Хранение',
  'empty.sources': 'Источников пока нет. Добавьте базу или хранилище для копирования.',
  'empty.destinations': 'Назначений пока нет. Добавьте облако или сервер для загрузки копий.',
  'empty.jobs': 'Задач пока нет. Задача связывает источник с назначением и запускается по расписанию.',
  'empty.history': 'Запусков пока нет.', 'empty.agents': 'Агентов пока нет.',
  'empty.versions': 'Версий пока нет. Сначала запустите копию — они появятся здесь (локально и в облаке).',
  'm.addSource': 'Добавить источник', 'm.addDestination': 'Добавить назначение', 'm.addJob': 'Добавить задачу', 'm.editJob': 'Изменить задачу',
  'loadMore': 'Показать ещё', 'connected': 'Подключённые назначения', 'recentRuns': 'Последние запуски',
};

const UZ: Dict = {
  'nav.dashboard': 'Boshqaruv', 'nav.sources': 'Manbalar', 'nav.destinations': 'Manzillar',
  'nav.jobs': 'Vazifalar', 'nav.history': 'Tarix', 'nav.agents': 'Agentlar', 'nav.settings': 'Sozlamalar',
  'app.signOut': 'Chiqish', 'app.theme': 'Mavzu', 'app.language': 'Til',
  'btn.add': 'Qo‘shish', 'btn.save': 'Saqlash', 'btn.cancel': 'Bekor qilish', 'btn.delete': 'O‘chirish',
  'btn.edit': 'Tahrirlash', 'btn.refresh': 'Yangilash', 'btn.remove': 'Olib tashlash', 'btn.connect': 'Ulash',
  'btn.runNow': 'Ishga tushirish', 'btn.test': 'Test', 'btn.drill': 'Sinov', 'btn.versions': 'Versiyalar',
  'btn.link': 'Bog‘lash', 'btn.sendTest': 'Test yuborish',
  'dash.title': 'Boshqaruv paneli', 'dash.subtitle': 'Backuplaringiz umumiy ko‘rinishi',
  'sources.title': 'Manbalar', 'sources.subtitle': 'Backup qilinadigan bazalar va xotiralar', 'sources.add': '+ Manba qo‘shish',
  'dest.title': 'Manzillar', 'dest.subtitle': 'Backuplar qayerga yuklanadi — rclone asosida (70+ bulut)', 'dest.add': '+ Manzil qo‘shish',
  'jobs.title': 'Vazifalar', 'jobs.subtitle': 'Manba + manzil, jadval bo‘yicha', 'jobs.add': '+ Vazifa qo‘shish',
  'history.title': 'Tarix', 'history.subtitle': 'Har bir backup, yuklash, sinov va tiklash',
  'agents.title': 'Agentlar', 'agents.subtitle': 'Backuplarni bajaradigan ishchi konteynerlar',
  'settings.title': 'Bildirishnomalar', 'settings.subtitle': 'O‘zingizning SMTP va Telegram botingizdan foydalaning — hech narsa ulashilmaydi, sirlar shifrlanadi.',
  'notify.on': 'Qachon xabar berish', 'notify.failure': 'Faqat xatoliklar', 'notify.always': 'Har safar', 'notify.never': 'Hech qachon',
  'f.name': 'Nomi', 'f.type': 'Turi', 'f.host': 'Host', 'f.port': 'Port', 'f.engine': 'Dvigatel',
  'f.username': 'Foydalanuvchi', 'f.password': 'Parol', 'f.target': 'Baza / Bucket', 'f.path': 'Yo‘l',
  'f.status': 'Holat', 'f.size': 'Hajm', 'f.started': 'Boshlandi', 'f.message': 'Xabar', 'f.job': 'Vazifa',
  'f.source': 'Manba', 'f.destination': 'Manzil', 'f.lastSeen': 'Oxirgi faollik', 'f.version': 'Versiya',
  'f.project': 'Loyiha', 'f.schedule': 'Jadval', 'f.agent': 'Agent', 'f.retention': 'Saqlash',
  'empty.sources': 'Hali manba yo‘q. Backup qilish uchun baza yoki bucket qo‘shing.',
  'empty.destinations': 'Hali manzil yo‘q. Backuplarni yuklash uchun bulut yoki server qo‘shing.',
  'empty.jobs': 'Hali vazifa yo‘q. Vazifa manbani manzilga bog‘lab, jadval bo‘yicha ishlaydi.',
  'empty.history': 'Hali ishga tushishlar yo‘q.', 'empty.agents': 'Hali agentlar ro‘yxatdan o‘tmagan.',
  'empty.versions': 'Hali versiya yo‘q. Avval backup ishga tushiring — ular shu yerda chiqadi (lokal va bulut).',
  'm.addSource': 'Manba qo‘shish', 'm.addDestination': 'Manzil qo‘shish', 'm.addJob': 'Vazifa qo‘shish', 'm.editJob': 'Vazifani tahrirlash',
  'loadMore': 'Yana ko‘rsatish', 'connected': 'Ulangan manzillar', 'recentRuns': 'So‘nggi ishga tushishlar',
};

const DICTS: Record<Locale, Dict> = { en: EN, ru: RU, uz: UZ };

@Injectable({ providedIn: 'root' })
export class Lang {
  private http = inject(HttpClient);
  private readonly key = 'backuphub.lang';
  readonly locale = signal<Locale>((localStorage.getItem(this.key) as Locale) || 'en');

  set(locale: Locale) {
    this.locale.set(locale);
    localStorage.setItem(this.key, locale);
    this.http.put('/api/settings/locale', { locale }).subscribe({ error: () => {} });
  }

  t(key: string): string {
    return DICTS[this.locale()][key] ?? DICTS.en[key] ?? key;
  }
}
