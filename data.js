// NewlyNow.com — categories data (used by category.html full pages)
window.faIcon = function (ic) {
  ic = ic || 'fa-layer-group';
  if (ic.indexOf(' ') > -1) return ic;
  return /^fa-(facebook|instagram|tiktok|youtube|telegram|x-twitter|twitter|snapchat|linkedin|whatsapp|discord|twitch|pinterest|reddit|threads|google|kickstarter)$/.test(ic)
    ? 'fa-brands ' + ic : 'fas ' + ic;
};
window.catDesc = function (title) {
  return 'كل ' + (title || 'الخدمات') + ' في مكان واحد — جودة عالية وتنفيذ آمن.';
};
window.CATEGORIES = {
  "ai": {
    icon: "fa-robot", g1: "#7C3AED", g2: "#E0208F", order: 0,
    title: "🤖 اشتراكات وحسابات الذكاء الاصطناعي",
    intro: "كل خدمات اشتراكات وحسابات الذكاء الاصطناعي في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الأدوات والحسابات", items: ["ChatGPT","Claude","Gemini","Grok","Midjourney","DALL·E","Leonardo AI","Runway","Kling AI","Veo","ElevenLabs","Suno","Udio","Cursor AI","Manus AI","Perplexity","Notion AI","Canva AI","OpenAI API","Anthropic API","Google AI Studio","GitHub Copilot","Replit AI","Lovable","Bolt.new","n8n","Zapier","Make (Integromat)"] } ]
  },
  "social": {
    icon: "fa-share-nodes", g1: "#17A85E", g2: "#0E7A45", order: 1,
    title: "📱 منصات التواصل الاجتماعي",
    intro: "كل خدمات منصات التواصل الاجتماعي في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنصات", items: ["Facebook","Instagram","TikTok","YouTube","Snapchat","X (Twitter)","Telegram","WhatsApp","Threads","LinkedIn","Pinterest","Reddit","Discord","Twitch","Kick","Facebook Messenger","WeChat","LINE","VK","Tumblr","Quora"] } ]
  },
  "games": {
    icon: "fa-gamepad", g1: "#FFD400", g2: "#FF8A00", order: 2,
    title: "🎮 شحن الألعاب",
    intro: "كل خدمات شحن الألعاب في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الألعاب والشحن", items: ["Steam","PlayStation","Xbox","Nintendo","PUBG","Free Fire","Fortnite","Valorant","EA Sports FC","Roblox","Riot Games","League of Legends","Call of Duty","Clash of Clans","Clash Royale","Brawl Stars"] } ]
  },
  "dev": {
    icon: "fa-code", g1: "#2F6FED", g2: "#17C8AC", order: 3,
    title: "💻 البرمجة والتطوير",
    intro: "كل خدمات البرمجة والتطوير في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["مواقع ويب","تطبيقات","بوتات","APIs","Telegram Bots","WhatsApp Bots","Discord Bots","Web Automation","AI Automation","GitHub","GitLab","Bitbucket","Docker","VPS","Cloud Hosting","Firebase"] } ]
  },
  "montage": {
    icon: "fa-film", g1: "#E0208F", g2: "#7C3AED", order: 4,
    title: "🎬 المونتاج وتصميم الفيديو",
    intro: "كل خدمات المونتاج وتصميم الفيديو في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["مونتاج فيديو","مونتاج ريلز وشورتس","مونتاج إعلانات","تصحيح ألوان","موشن جرافيك","إضافة سبتايتل / ترجمة","مونتاج بودكاست","تحسين جودة الفيديو"] } ]
  },
  "music": {
    icon: "fa-music", g1: "#FF8A00", g2: "#17A85E", order: 5,
    title: "🎵 منصات الموسيقى",
    intro: "كل خدمات منصات الموسيقى في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنصات", items: ["Spotify","SoundCloud","Anghami","Deezer","Apple Music","YouTube Music","Audiomack","Boomplay","Tidal","Amazon Music","Pandora","Napster"] } ]
  },
  "video": {
    icon: "fa-clapperboard", g1: "#17C8AC", g2: "#2F6FED", order: 6,
    title: "🎞️ منصات الفيديو والبث",
    intro: "كل خدمات منصات الفيديو والبث في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنصات", items: ["YouTube","Vimeo","Dailymotion","Twitch","Kick","Bigo Live","Likee","Kwai","Rumble","TikTok Live","Netflix","Shahid","Disney+","Prime Video","OSN+","Watch It","Hulu"] } ]
  },
  "email": {
    icon: "fa-envelope", g1: "#F43F5E", g2: "#FB923C", order: 7,
    title: "📧 البريد الإلكتروني",
    intro: "كل خدمات البريد الإلكتروني في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنصات", items: ["Gmail","Outlook","Yahoo","Proton Mail","Zoho Mail","Microsoft 365","Google Workspace"] } ]
  },
  "cloud": {
    icon: "fa-cloud", g1: "#10B981", g2: "#059669", order: 8,
    title: "☁️ التخزين السحابي",
    intro: "كل خدمات التخزين السحابي في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنصات", items: ["Google Drive","Dropbox","OneDrive","MEGA","iCloud","Box","pCloud"] } ]
  },
  "web": {
    icon: "fa-globe", g1: "#6366F1", g2: "#8B5CF6", order: 9,
    title: "🌐 المواقع والمتاجر",
    intro: "كل خدمات المواقع والمتاجر في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["تصميم مواقع","تصميم متاجر","WordPress","Shopify","WooCommerce","OpenCart","PrestaShop","Wix","Webflow","Framer","Laravel","React","Next.js","دومينات","استضافة","SSL"] } ]
  },
  "ads": {
    icon: "fa-bullhorn", g1: "#7C3AED", g2: "#E0208F", order: 10,
    title: "📢 الإعلانات الممولة",
    intro: "كل خدمات الإعلانات الممولة في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنصات", items: ["Meta Ads","Google Ads","TikTok Ads","Snapchat Ads","X Ads","LinkedIn Ads","YouTube Ads","Pinterest Ads","Reddit Ads","Microsoft Ads","Amazon Ads"] } ]
  },
  "trade": {
    icon: "fa-right-left", g1: "#17A85E", g2: "#0E7A45", order: 11,
    title: "🛒 البيع والشراء",
    intro: "كل خدمات البيع والشراء في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["بيع حسابات","شراء حسابات","صفحات","قنوات","مواقع","دومينات","تطبيقات","بوتات","مجموعات","جروبات","سيرفرات Discord","سيرفرات Telegram","اشتراكات"] } ]
  },
  "verify": {
    icon: "fa-circle-check", g1: "#FFD400", g2: "#FF8A00", order: 12,
    title: "✅ التوثيق الرسمي",
    intro: "كل خدمات التوثيق الرسمي في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنصات", items: ["Facebook","Instagram","TikTok","Snapchat","X","WhatsApp Business","Meta Verified","YouTube","Telegram","LinkedIn"] } ]
  },
  "protect": {
    icon: "fa-shield-halved", g1: "#2F6FED", g2: "#17C8AC", order: 13,
    title: "🛡️ الحماية والاسترجاع",
    intro: "كل خدمات الحماية والاسترجاع في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["استرجاع الحسابات","استعادة الصفحات","استعادة القنوات","استعادة البريد الإلكتروني","فك التقييد","إزالة الانتهاكات","إزالة البلاغات","حماية الحسابات","تأمين الحسابات"] } ]
  },
  "smm": {
    icon: "fa-chart-line", g1: "#E0208F", g2: "#7C3AED", order: 14,
    title: "📊 خدمات SMM",
    intro: "كل خدمات خدمات SMM في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["متابعين","لايكات","مشاهدات","تعليقات","مشاركات","حفظ","ريتويت","ريلز","ستوري","بث مباشر","ساعات مشاهدة","تصويتات","أعضاء","تنزيلات","استماعات","نجوم","هدايا","دعوات"] } ]
  },
  "subscriptions": {
    icon: "fa-credit-card", g1: "#FF8A00", g2: "#17A85E", order: 15,
    title: "💳 الاشتراكات الرقمية",
    intro: "كل خدمات الاشتراكات الرقمية في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الاشتراكات", items: ["Netflix","Shahid","OSN+","Disney+","Spotify Premium","YouTube Premium","Canva Pro","Adobe Creative Cloud","Microsoft 365","Google One","ChatGPT Plus","Claude Pro","Gemini Advanced","CapCut Pro","Envato Elements","Freepik Premium","Figma Professional","Notion Plus","Grammarly Premium","Zoom Pro"] } ]
  },
  "crypto": {
    icon: "fa-coins", g1: "#17C8AC", g2: "#2F6FED", order: 16,
    title: "💰 العملات الرقمية",
    intro: "كل خدمات العملات الرقمية في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنصات والمحافظ", items: ["Binance","Bybit","OKX","KuCoin","Coinbase","MEXC","Bitget","Gate.io","CoinEx","Trust Wallet","MetaMask","Phantom Wallet"] } ]
  },
  "marketing": {
    icon: "fa-arrow-trend-up", g1: "#F43F5E", g2: "#FB923C", order: 17,
    title: "📈 التسويق الرقمي",
    intro: "كل خدمات التسويق الرقمي في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["SEO","SEM","Email Marketing","SMS Marketing","Google Analytics","Google Tag Manager","Google Search Console","Social Media Management","Branding","صناعة المحتوى","الهوية التجارية"] } ]
  },
  "escrow": {
    icon: "fa-handshake", g1: "#10B981", g2: "#059669", order: 18,
    title: "🤝 الوساطة الآمنة",
    intro: "كل خدمات الوساطة الآمنة في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["وساطة الحسابات","وساطة الصفحات","وساطة القنوات","وساطة المواقع","وساطة الدومينات","وساطة الخدمات","وساطة العملات الرقمية","وساطة التطبيقات","وساطة الاشتراكات","وساطة الخدمات البرمجية"] } ]
  },
  "vnumbers": {
    icon: "fa-mobile-screen-button", g1: "#6366F1", g2: "#8B5CF6", order: 19,
    title: "📲 أرقام افتراضية (SMS Verification)",
    intro: "كل خدمات أرقام افتراضية (SMS Verification) في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["أرقام تفعيل واتساب","أرقام تفعيل تيليجرام","أرقام تفعيل جوجل","أرقام تفعيل فيسبوك","أرقام تفعيل إنستجرام","أرقام دول متعددة"] } ]
  },
  "esim": {
    icon: "fa-sim-card", g1: "#7C3AED", g2: "#E0208F", order: 20,
    title: "📞 شرائح eSIM",
    intro: "كل خدمات شرائح eSIM في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["eSIM سفر","eSIM دولية","eSIM بيانات","باقات eSIM شهرية"] } ]
  },
  "vpn": {
    icon: "fa-user-shield", g1: "#17A85E", g2: "#0E7A45", order: 21,
    title: "🌍 VPN & Proxy",
    intro: "كل خدمات VPN & Proxy في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["VPN اشتراكات","Proxy سكني","Proxy داتا سنتر","Proxy موبايل","IP ثابت"] } ]
  },
  "cdn": {
    icon: "fa-server", g1: "#FFD400", g2: "#FF8A00", order: 22,
    title: "🌐 CDN & DNS",
    intro: "كل خدمات CDN & DNS في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["Cloudflare","CDN تسريع","DNS إدارة","حماية DDoS","SSL شهادات"] } ]
  },
  "technews": {
    icon: "fa-newspaper", g1: "#2F6FED", g2: "#17C8AC", order: 23,
    title: "📰 الأخبار التقنية",
    intro: "كل خدمات الأخبار التقنية في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المحتوى", items: ["أخبار الذكاء الاصطناعي","أخبار الكريبتو","أخبار السوشيال ميديا","مراجعات أدوات","نشرات بريدية"] } ]
  },
  "design": {
    icon: "fa-palette", g1: "#E0208F", g2: "#7C3AED", order: 24,
    title: "🎨 التصميم والجرافيك",
    intro: "كل خدمات التصميم والجرافيك في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["تصميم لوجو","هوية بصرية","بوستات سوشيال ميديا","موشن جرافيك","تصميم 3D","UI/UX","تصميم بنرات إعلانية"] } ]
  },
  "print": {
    icon: "fa-print", g1: "#FF8A00", g2: "#17A85E", order: 25,
    title: "🖨️ الطباعة عند الطلب",
    intro: "كل خدمات الطباعة عند الطلب في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["طباعة تيشيرتات","مج وأكواب","استيكرات","بوسترات","كروت شخصية","بروشورات"] } ]
  },
  "courses": {
    icon: "fa-graduation-cap", g1: "#17C8AC", g2: "#2F6FED", order: 26,
    title: "📚 الدورات التعليمية",
    intro: "كل خدمات الدورات التعليمية في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الدورات", items: ["دورات برمجة","دورات تسويق","دورات تصميم","دورات ذكاء اصطناعي","دورات تداول","دورات لغات"] } ]
  },
  "contests": {
    icon: "fa-trophy", g1: "#F43F5E", g2: "#FB923C", order: 27,
    title: "🏆 المسابقات والهدايا",
    intro: "كل خدمات المسابقات والهدايا في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["مسابقات سوشيال ميديا","جيف أواي","سحوبات","هدايا العملاء","برامج ولاء"] } ]
  },
  "business": {
    icon: "fa-briefcase", g1: "#10B981", g2: "#059669", order: 28,
    title: "💼 الأعمال والشركات",
    intro: "كل خدمات الأعمال والشركات في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["تأسيس شركات","خطط أعمال","استشارات تسويقية","إدارة مشاريع","حلول SaaS","أنظمة CRM"] } ]
  },
  "analytics": {
    icon: "fa-chart-pie", g1: "#6366F1", g2: "#8B5CF6", order: 29,
    title: "📉 التحليلات والتقارير",
    intro: "كل خدمات التحليلات والتقارير في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "الخدمات", items: ["تقارير أداء","تحليل منافسين","لوحات معلومات","تتبع تحويلات","تقارير سوشيال ميديا"] } ]
  },
  "licenses": {
    icon: "fa-key", g1: "#7C3AED", g2: "#E0208F", order: 30,
    title: "🔑 التراخيص والمفاتيح الرقمية",
    intro: "كل خدمات التراخيص والمفاتيح الرقمية في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "المنتجات", items: ["Windows مفاتيح","Office مفاتيح","برامج أنتي فايروس","تراخيص برامج","مفاتيح ألعاب"] } ]
  },
  "giftcards": {
    icon: "fa-gift", g1: "#17A85E", g2: "#0E7A45", order: 31,
    title: "🎁 بطاقات الهدايا",
    intro: "كل خدمات بطاقات الهدايا في مكان واحد — جودة عالية وتنفيذ احترافي وآمن، مع دعم ومتابعة كاملة.",
    groups: [ { h: "البطاقات", items: ["iTunes","Google Play","Steam","PlayStation","Xbox","Amazon","Netflix","Roblox","بطاقات شحن"] } ]
  }
};
