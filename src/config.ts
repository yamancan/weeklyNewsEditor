import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

function getEnvVariable(key: string, defaultValue?: string): string | undefined {
    const value = process.env[key] ?? defaultValue;
    return value;
}

function getEnvVariableAsNumber(key: string, defaultValue?: number): number | undefined {
    const valueStr = getEnvVariable(key, defaultValue?.toString());
    if (valueStr === undefined) return undefined;
    const value = parseInt(valueStr, 10);
    if (isNaN(value)) {
        throw new Error(`Environment variable ${key} (value: "${valueStr}") must be a number if provided.`);
    }
    return value;
}

function getEnvVariableAsArray(key: string, defaultValue?: string[]): number[] {
    const valueStr = getEnvVariable(key, defaultValue?.join(','));
    if (!valueStr) return [];
    return valueStr.split(',').map(id => {
        const num = parseInt(id.trim(), 10);
        if (isNaN(num)) {
            throw new Error(`Invalid number found in ${key}: ${id.trim()}`);
        }
        return num;
    }).filter(id => !isNaN(id));
}

function getRequiredEnvVariable(key: string, defaultValue?: string): string {
    const value = process.env[key] ?? defaultValue;
    if (value === undefined || value === null || value === '') {
        throw new Error(`Required environment variable ${key} is not set and no default was provided.`);
    }
    return value;
}

function getRequiredEnvVariableAsNumber(key: string, defaultValue?: number): number {
    const valueStr = getRequiredEnvVariable(key, defaultValue?.toString());
    const value = parseInt(valueStr, 10);
    if (isNaN(value)) {
        throw new Error(`Required environment variable ${key} (value: "${valueStr}") must be a number.`);
    }
    return value;
}

export const config = {
    telegram: {
        botToken: getRequiredEnvVariable('TELEGRAM_BOT_TOKEN'),
        /** Editorler grubunun ID'si */
        editorsGroupId: getRequiredEnvVariableAsNumber('EDITORS_GROUP_ID'),
        /** Haberlerin yayınlanacağı nihai kanalın ID'si */
        newsChannelId: getRequiredEnvVariableAsNumber('NEWS_CHANNEL_ID'),
        /** Bot'a doğrudan mesaj göndermesine ve komutları kullanmasına izin verilen kullanıcı ID'leri */
        allowedUserIds: getEnvVariableAsArray('ALLOWED_USER_IDS', []),
    },
    listener: {
        apiId: getEnvVariableAsNumber('TELEGRAM_API_ID'),
        apiHash: getEnvVariable('TELEGRAM_API_HASH'),
        phoneNumber: getEnvVariable('TELEGRAM_PHONE_NUMBER'),
        sessionPath: getEnvVariable('TELEGRAM_SESSION_PATH', './telegram_session'),
        /** Dinlenecek kaynak Telegram kanal/grup ID'leri (virgülle ayrılmış) */
        sourceChatIds: (getEnvVariable('SOURCE_CHAT_IDS') || '').split(',').map(id => id.trim()).filter(id => id),
        /** Listener client'ının kendi kullanıcı ID'si. 
         *  Bu ID'nin `allowedUserIds` içinde olması önerilir, 
         *  böylece listener'dan bota gönderilen mesajlar yetkili kabul edilir.
         */
        listenerUserId: process.env.LISTENER_USER_ID ? getEnvVariableAsNumber('LISTENER_USER_ID') : undefined,
    },
    openai: {
        apiKey: getRequiredEnvVariable('OPENAI_API_KEY'),
        defaultModel: getRequiredEnvVariable('OPENAI_DEFAULT_MODEL', 'gpt-4o'),
        systemPrompt: getRequiredEnvVariable('OPENAI_SYSTEM_PROMPT', "Kullanıcıların sağladığı içeriklerden etkili ve özlü bültenler oluşturmalarına yardımcı olan bir editör olarak çalışacaksın. Sağlanan haberleri analiz eder, önemli noktaları belirler ve kullanıcıya net ve anlaşılır bir bülten taslağı sunar. Haberler doğrudan metin olarak verilecektir."),
        readyPrompt: getRequiredEnvVariable('OPENAI_READY_PROMPT', `
            Haber içeriğini değerlendirirken tüm metni okur ve metnin önemli vurgulanan noktalarını belirler.
            Haberin stratejik, finansal, ekonomik önemlerini değerlendirir.
            Metni daha önce okuduğu haberler ve sahip olduğu güncel bilgiyle birlikte değerlendirir.
            Verilen haberin 3 cümle ile önemli noktalarını özetler. Bu özette mutlaka sayısal bilgilere, vurgulanan noktalara yer verir.
            Ardından bu özeti haber içeriğini gözden geçirerek tekrar değerlendirir ve ikinci değerlendirmesinde karşılaştırır ve karşılaştırmasını ekler.
            Eğer içerik İngilizce ise Türkçe'ye çevirir. İçerik kaynak linki barındırmıyorsa, kaynak linkini eklemez.
            Örnek format:
            [Başlık]
            [içerik, önemli noktalar, varsa sayılar]
            [Kaynak](www.Link.com)
            `),
    },
    scraper: {
        homeUrl: getRequiredEnvVariable('HOME_URL', 'https://www.ledgerinsights.com/category/news/'),
        intervalHours: getEnvVariableAsNumber('SCRAPE_INTERVAL_HOURS') ?? 4,
    },
    logLevel: getEnvVariable('LOG_LEVEL', 'info'),
}; 