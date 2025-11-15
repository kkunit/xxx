import React, { useEffect, useMemo, useState } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query } from 'firebase/firestore';
import {
  Feather,
  Info,
  Lock,
  Mail,
  MoonStar,
  Share2,
  Sparkles,
  Star,
  Stars,
  Unlock
} from 'lucide-react';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAxoiJDaMlrgVcxoFx20jcNoZ3drYROsxk',
  authDomain: 'kkkk-ed5ea.firebaseapp.com',
  projectId: 'kkkk-ed5ea',
  storageBucket: 'kkkk-ed5ea.firebasestorage.app',
  messagingSenderId: '430553604960',
  appId: '1:430553604960:web:7aec087fdd169ccd123405',
  measurementId: 'G-SN2216JTKY'
};

const REQUIRED_CONFIG_KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];

const readRuntimeConfig = () => {
  if (typeof globalThis === 'undefined') {
    return undefined;
  }

  const value = globalThis.__firebase_config;
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.warn('Unable to parse runtime Firebase config string:', error);
      return undefined;
    }
  }

  return value;
};

const resolveFirebaseConfig = () => {
  const runtime = readRuntimeConfig();

  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  };

  const config = REQUIRED_CONFIG_KEYS.reduce(
    (accumulator, key) => ({
      ...accumulator,
      [key]: runtime?.[key] ?? envConfig[key] ?? DEFAULT_FIREBASE_CONFIG[key]
    }),
    {}
  );

  if (!REQUIRED_CONFIG_KEYS.every((key) => Boolean(config[key]))) {
    return null;
  }

  const measurementId = runtime?.measurementId ?? envConfig.measurementId ?? DEFAULT_FIREBASE_CONFIG.measurementId;
  return measurementId ? { ...config, measurementId } : config;
};

const firebaseConfig = resolveFirebaseConfig();

let app = null;
let auth = null;
let db = null;

if (firebaseConfig) {
  const existing = getApps()[0];
  app = existing || initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.warn('Firebase configuration is missing. Please check your environment variables.');
}

const resolveAppId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.__app_id) {
    return globalThis.__app_id;
  }
  return firebaseConfig?.projectId || 'default-app-id';
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('write');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showShareHelp, setShowShareHelp] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copyState, setCopyState] = useState('idle');
  const [authError, setAuthError] = useState(null);

  const configError = !firebaseConfig;
  const SECRET_CODE = '520';

  const uniqueAppId = useMemo(resolveAppId, []);
  const canUseNavigator = typeof navigator !== 'undefined';
  const canUseShare = canUseNavigator && typeof navigator.share === 'function';

  const cardThemes = useMemo(
    () => [
      {
        wrapper: 'bg-indigo-50/80 border border-indigo-200',
        badge: 'bg-indigo-200/80 text-indigo-800'
      },
      {
        wrapper: 'bg-sky-50/80 border border-sky-200',
        badge: 'bg-sky-200/80 text-sky-800'
      },
      {
        wrapper: 'bg-amber-50/80 border border-amber-200',
        badge: 'bg-amber-200/80 text-amber-800'
      }
    ],
    []
  );

  const resolveTheme = (index = 0) => cardThemes[index % cardThemes.length];

  const getCurrentHostname = () => {
    if (typeof window === 'undefined') {
      return '当前域名';
    }
    return window.location.hostname;
  };

  const DEFAULT_AUTH_ERROR_MESSAGE = '星星登录遇到了一点小问题，请刷新后再试~';

  const resolveAuthGuidance = (error) => {
    if (!error) {
      return null;
    }

    switch (error.code) {
      case 'auth/operation-not-allowed':
        return {
          reason: 'Firebase 项目尚未启用 Anonymous 匿名登录。',
          action: '在 Firebase 控制台 Authentication → Sign-in method 中启用 Anonymous 登录方式，然后重新部署站点。'
        };
      case 'auth/unauthorized-domain':
        return {
          reason: `当前域名 ${getCurrentHostname()} 未加入 Firebase 的 Authorized domains 白名单。`,
          action: '在 Firebase 控制台 Authentication → Settings → Authorized domains 中添加该域名后重新部署。'
        };
      case 'auth/network-request-failed':
        return {
          reason: '网络连接异常或 Firebase 请求被浏览器拦截。',
          action: '检查当前网络环境，或确认浏览器/防火墙没有阻止访问 *.firebaseapp.com 与 *.googleapis.com。'
        };
      default:
        if (error.message) {
          return {
            reason: error.message
          };
        }
        return null;
    }
  };

  const handleAuthError = (error) => {
    console.error('Firebase auth error:', error);
    const guidance = resolveAuthGuidance(error);
    if (guidance?.action) {
      console.info(`[登录配置提醒] ${guidance.action}`);
    }
    setAuthError({
      message: DEFAULT_AUTH_ERROR_MESSAGE,
      reason: guidance?.reason ?? null,
      action: guidance?.action ?? null
    });
    return DEFAULT_AUTH_ERROR_MESSAGE;
  };

  const DEFAULT_FIRESTORE_ERROR_MESSAGE = '星星邮差迷路了，请刷新后再试~';
  const SEND_TIMEOUT_MS = 12000;

  const withTimeout = (promise, timeout) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(`等待 Firestore 响应超过 ${Math.round(timeout / 1000)} 秒`);
        error.code = 'client/send-timeout';
        reject(error);
      }, timeout);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });

  const resolveFirestoreGuidance = (error) => {
    if (!error) {
      return null;
    }

    switch (error.code) {
      case 'permission-denied':
        return {
          reason: 'Firestore 安全规则禁止当前登录方式写入留言。',
          action:
            '在 Firebase 控制台 Firestore Database → Rules 中允许匿名用户写入 artifacts/{appId}/public/data/sugar_messages，或改用受支持的身份验证方式。'
        };
      case 'failed-precondition':
        return {
          reason: 'Firestore 索引或项目状态异常。',
          action: '确认已经在 Firebase 控制台启用 Firestore 并完成数据库初始化。'
        };
      case 'unavailable':
        return {
          reason: 'Firestore 服务暂时不可用或网络连接异常。',
          action: '稍后再试，或检查部署环境是否能够访问 *.firebaseio.com 与 *.googleapis.com。'
        };
      case 'client/send-timeout':
        return {
          reason: `等待 Firestore 响应超过 ${Math.round(SEND_TIMEOUT_MS / 1000)} 秒。`,
          action: '检查服务器与浏览器的网络环境，确认可以正常访问 Firestore 接口。'
        };
      default:
        if (error.message) {
          return { reason: error.message };
        }
        return null;
    }
  };

  const handleFirestoreError = (error) => {
    console.error('Firestore error:', error);
    const guidance = resolveFirestoreGuidance(error);
    if (guidance?.action) {
      console.info(`[数据库配置提醒] ${guidance.action}`);
    }
    const baseMessage = DEFAULT_FIRESTORE_ERROR_MESSAGE;
    if (!guidance?.reason) {
      return baseMessage;
    }
    return `${baseMessage}\n\n可能的原因：${guidance.reason}`;
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setShareUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (configError || !auth) {
      return undefined;
    }

    const initAuth = async () => {
      try {
        const initialToken =
          typeof globalThis !== 'undefined' ? globalThis.__initial_auth_token : undefined;
        if (initialToken) {
          await signInWithCustomToken(auth, initialToken);
        } else if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        handleAuthError(error);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, [auth, configError]);

  useEffect(() => {
    if (configError || !db) {
      return undefined;
    }
    if (!user || view !== 'read' || !isUnlocked) {
      return undefined;
    }

    const messagesQuery = query(collection(db, 'artifacts', uniqueAppId, 'public', 'data', 'sugar_messages'));
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const nextMessages = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data()
          }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setMessages(nextMessages);
      },
      (error) => {
        console.error('Error fetching messages:', error);
      }
    );

    return () => unsubscribe();
  }, [configError, db, isUnlocked, uniqueAppId, user, view]);

  const handleSend = async (event) => {
    event.preventDefault();
    if (!messageContent.trim()) {
      return;
    }

    if (configError || !db || !auth) {
      alert('星星信使暂时忙碌，请稍后再试~');
      return;
    }

    let activeUser = user || auth.currentUser;
    if (!activeUser) {
      try {
        const credential = await signInAnonymously(auth);
        activeUser = credential.user;
        setUser(activeUser);
      } catch (error) {
        const message = handleAuthError(error);
        alert(message);
        return;
      }
    }

    setLoading(true);
    try {
      await withTimeout(
        addDoc(collection(db, 'artifacts', uniqueAppId, 'public', 'data', 'sugar_messages'), {
          name: senderName.trim() || '匿名星友',
          content: messageContent,
          timestamp: Date.now(),
          theme: Math.floor(Math.random() * cardThemes.length)
        }),
        SEND_TIMEOUT_MS
      );

      setShowSuccess(true);
      setSenderName('');
      setMessageContent('');
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      const message = handleFirestoreError(error);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = (event) => {
    event.preventDefault();
    if (adminCode === SECRET_CODE) {
      setIsUnlocked(true);
      setAdminCode('');
    } else {
      alert('星星暗号不对哦！');
    }
  };

  const bgStyle = {
    backgroundImage:
      'linear-gradient(135deg, rgba(244, 228, 255, 0.96) 0%, rgba(219, 234, 254, 0.96) 55%, rgba(255, 247, 237, 0.95) 100%), radial-gradient(#fde68a 1px, transparent 1px), radial-gradient(#fbcfe8 1px, transparent 1px)',
    backgroundSize: '100% 100%, 32px 32px, 48px 48px',
    backgroundPosition: 'center, 8px 12px, 24px 28px',
    backgroundColor: '#f5f3ff'
  };

  return (
    <div
      style={bgStyle}
      className="min-h-screen w-full flex flex-col items-center font-sans text-slate-700 relative overflow-hidden selection:bg-indigo-200/70"
    >
      {authError && (
        <div className="fixed top-6 inset-x-0 flex justify-center z-[80] px-4">
          <div className="max-w-xl w-full bg-white/90 border border-rose-200 text-rose-600 rounded-2xl shadow-lg px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <Lock size={18} />
              <span>登录配置提醒</span>
            </div>
            <p className="text-sm leading-relaxed">{authError.message}</p>
            {authError.reason && (
              <p className="text-xs leading-relaxed text-rose-500/90">
                可能的原因：{authError.reason}
              </p>
            )}
            {authError.action && (
              <p className="text-xs leading-relaxed text-rose-500/80">
                排查建议：{authError.action}
              </p>
            )}
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="self-end text-xs text-rose-500 hover:text-rose-600 transition-colors"
            >
              我知道啦
            </button>
          </div>
        </div>
      )}

      {configError && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-white">
          <div className="max-w-md mx-auto text-center space-y-4 px-6">
            <div className="flex justify-center">
              <Mail className="text-indigo-500" size={48} />
            </div>
            <h1 className="text-2xl font-bold text-indigo-600">配置缺失</h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              星星信箱需要正确的 Firebase 配置才能工作。请在部署环境中设置
              <code className="mx-1 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">VITE_FIREBASE_*</code>
              环境变量并重新部署。
            </p>
          </div>
        </div>
      )}

      {showShareHelp && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowShareHelp(false)}
        >
          <div
            className="bg-gradient-to-br from-white via-indigo-50 to-amber-50 rounded-3xl p-6 max-w-sm w-full shadow-2xl border-4 border-indigo-200/80 ring-4 ring-white/60 animate-bounce-in"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-indigo-600 mb-3 flex items-center gap-2">
              <Info size={24} /> 如何把星星信箱分享给朋友？
            </h3>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                <span className="font-bold text-gray-800">这是可以分享的星星坐标！</span>
                <br />
                复制下面的地址或者直接使用手机的分享面板，把星光邮差派给朋友吧～
              </p>
              {shareUrl ? (
                <div className="bg-white/80 border border-indigo-200 rounded-2xl p-3 space-y-2 shadow-inner">
                  <code className="block text-xs break-words text-indigo-700">{shareUrl}</code>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (typeof navigator === 'undefined' || !navigator.clipboard) {
                          setCopyState('error');
                          return;
                        }
                        try {
                          await navigator.clipboard.writeText(shareUrl);
                          setCopyState('copied');
                          setTimeout(() => setCopyState('idle'), 2000);
                        } catch (error) {
                          console.error('复制链接失败', error);
                          setCopyState('error');
                        }
                      }}
                      className="flex-1 bg-indigo-500 text-white py-2 rounded-xl text-sm font-semibold shadow hover:bg-indigo-600 transition-colors"
                    >
                      {copyState === 'copied' ? '已复制 ✓' : '复制链接'}
                    </button>
                    {canUseShare && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.share({ title: '星星信箱', url: shareUrl });
                          } catch (error) {
                            if (error?.name !== 'AbortError') {
                              console.error('调用分享面板失败', error);
                            }
                          }
                        }}
                        className="flex-1 bg-white text-indigo-500 border border-indigo-300 py-2 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-50 transition-colors"
                      >
                        打开分享面板
                      </button>
                    )}
                  </div>
                  {copyState === 'error' && (
                    <p className="text-xs text-rose-500">浏览器不支持自动复制，请长按链接手动复制哦～</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">稍等一下，我们正在准备分享链接…</p>
              )}
              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-xl p-2">
                小贴士：暗号是主人才能分享的宇宙密码，别放在公开页面里，悄悄告诉收信的朋友就好～
              </p>
            </div>
            <button
              onClick={() => setShowShareHelp(false)}
              className="w-full mt-5 bg-indigo-500 text-white py-3 rounded-xl font-bold shadow-md hover:bg-indigo-600 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      <div className="absolute top-10 left-8 text-indigo-200 animate-bounce delay-700 select-none pointer-events-none">
        <Stars size={48} />
      </div>
      <div className="absolute bottom-20 right-10 text-amber-200 animate-pulse select-none pointer-events-none">
        <MoonStar size={52} />
      </div>

      <header className="w-full max-w-3xl p-4 md:p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-indigo-100">
          <Mail className="text-indigo-500" size={20} />
          <span className="font-bold text-indigo-600 tracking-wider">星星信箱</span>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => setView('write')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors shadow-sm ${
              view === 'write'
                ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg'
                : 'bg-white/80 text-indigo-500 border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            <Sparkles size={18} />
            <span>写一封闪闪的信</span>
          </button>
          <button
            type="button"
            onClick={() => setView('read')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors shadow-sm ${
              view === 'read'
                ? 'bg-amber-500 text-white border-amber-500 shadow-lg'
                : 'bg-white/80 text-amber-500 border-amber-200 hover:bg-amber-50'
            }`}
          >
            <Mail size={18} />
            <span>看看大家的星语</span>
          </button>
          <button
            type="button"
            onClick={() => setShowShareHelp(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-sky-200 bg-sky-50/80 text-sky-600 hover:bg-sky-100 transition-colors shadow-sm"
          >
            <Share2 size={18} />
            <span>如何分享？</span>
          </button>
        </div>
      </header>

      <main className="w-full max-w-3xl px-4 pb-16 z-10">
        <div className="bg-white/85 backdrop-blur-md rounded-3xl shadow-xl border border-indigo-100 p-6 md:p-10 relative overflow-hidden">
          <div className="absolute -top-12 -right-8 w-40 h-40 bg-indigo-200/40 rounded-full blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-16 -left-12 w-44 h-44 bg-amber-200/40 rounded-full blur-3xl" aria-hidden="true" />

          {view === 'write' && (
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <Feather className="text-indigo-500" size={28} />
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-indigo-600">写下想要寄出的星语</h1>
                  <p className="text-sm text-gray-500 mt-1">留言会被装进主人的星星信箱，等 TA 来点亮银河！</p>
                </div>
              </div>

              <form onSubmit={handleSend} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-indigo-600 mb-2">你的昵称（可选）</label>
                  <input
                    value={senderName}
                    onChange={(event) => setSenderName(event.target.value)}
                    placeholder="写下你的名字或留空匿名星友"
                    className="w-full px-4 py-3 rounded-2xl border border-indigo-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    maxLength={30}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-600 mb-2">想对 TA 说的话</label>
                  <textarea
                    value={messageContent}
                    onChange={(event) => setMessageContent(event.target.value)}
                    placeholder="把心里话写下来，只有主人能在星空下读到哦~"
                    className="w-full px-4 py-3 rounded-2xl border border-indigo-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[160px]"
                    maxLength={600}
                  />
                  <p className="mt-2 text-xs text-gray-400">字数上限 600 字，支持换行～</p>
                </div>

                {showSuccess && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                    <Star size={18} className="text-amber-500" />
                    <span>闪亮的留言已飞向信箱，感谢你的星光！</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 rounded-2xl shadow-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? '星光传送中...' : '发送这封星语'}
                </button>
              </form>
            </div>
          )}

          {view === 'read' && (
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                {isUnlocked ? <Unlock className="text-amber-500" size={28} /> : <Lock className="text-amber-500" size={28} />}
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-amber-600">打开信箱看看星语</h1>
                  <p className="text-sm text-gray-500 mt-1">输入主人设置的星星暗号后，才能看到大家留下的心意。</p>
                </div>
              </div>

              {!isUnlocked ? (
                <form onSubmit={handleUnlock} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-amber-600 mb-2">输入星星暗号</label>
                    <input
                      type="password"
                      value={adminCode}
                      onChange={(event) => setAdminCode(event.target.value)}
                      placeholder="只有主人知道的小秘密"
                      className="w-full px-4 py-3 rounded-2xl border border-amber-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-2xl shadow-lg transition-colors"
                  >
                    <Unlock size={18} />
                    <span>开启信箱</span>
                  </button>
                  <p className="text-xs text-gray-400 text-center">暗号对啦就能解锁银河，忘记的话去问问 TA 哦～</p>
                </form>
              ) : (
                <div className="space-y-5">
                  {messages.length === 0 ? (
                    <div className="text-center bg-white/70 border border-dashed border-indigo-200 rounded-3xl py-16 px-6">
                      <Sparkles className="mx-auto text-indigo-300 mb-4" size={32} />
                      <p className="text-gray-500">暂时还没有收到星语，快邀请朋友来写下第一封吧！</p>
                    </div>
                  ) : (
                    <ul className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                      {messages.map((msg) => {
                        const { wrapper, badge } = resolveTheme(msg.theme ?? 0);
                        const displayTime = msg.timestamp
                          ? new Date(msg.timestamp).toLocaleString('zh-CN', { hour12: false })
                          : '刚刚';
                        return (
                          <li key={msg.id} className={`rounded-3xl p-5 shadow-sm backdrop-blur-sm ${wrapper}`}>
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-semibold text-gray-800">{msg.name || '匿名星友'}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge}`}>
                                  星光 +{((msg.theme ?? 0) % cardThemes.length) + 1}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">{displayTime}</span>
                            </div>
                            <p className="mt-3 text-gray-700 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
