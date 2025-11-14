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
  Candy,
  Heart,
  Info,
  Lock,
  Mail,
  Send,
  Share2,
  Sparkles,
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

  const configError = !firebaseConfig;
  const SECRET_CODE = '520';

  const uniqueAppId = useMemo(resolveAppId, []);

  const cardThemes = useMemo(
    () => [
      {
        wrapper: 'bg-pink-50/80 border border-pink-200',
        badge: 'bg-pink-200/80 text-pink-800'
      },
      {
        wrapper: 'bg-purple-50/80 border border-purple-200',
        badge: 'bg-purple-200/70 text-purple-800'
      },
      {
        wrapper: 'bg-orange-50/80 border border-orange-200',
        badge: 'bg-orange-200/80 text-orange-800'
      }
    ],
    []
  );

  const resolveTheme = (index = 0) => cardThemes[index % cardThemes.length];

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
        console.error('Firebase auth error:', error);
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
      alert('发送功能暂时不可用，请稍后再试~');
      return;
    }

    let activeUser = user || auth.currentUser;
    if (!activeUser) {
      try {
        const credential = await signInAnonymously(auth);
        activeUser = credential.user;
        setUser(activeUser);
      } catch (error) {
        console.error('Firebase Anonymous Auth error:', error);
        alert('登陆遇到了一点小问题，请刷新后再试~');
        return;
      }
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', uniqueAppId, 'public', 'data', 'sugar_messages'), {
        name: senderName.trim() || '匿名小可爱',
        content: messageContent,
        timestamp: Date.now(),
        theme: Math.floor(Math.random() * cardThemes.length)
      });

      setShowSuccess(true);
      setSenderName('');
      setMessageContent('');
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('发送遇到了一点小问题，请刷新后再试~');
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
      alert('暗号不对哦！');
    }
  };

  const bgStyle = {
    backgroundImage: `radial-gradient(#fbcfe8 1px, transparent 1px), radial-gradient(#fbcfe8 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 10px 10px',
    backgroundColor: '#fff1f2'
  };

  return (
    <div
      style={bgStyle}
      className="min-h-screen w-full flex flex-col items-center font-sans text-slate-700 relative overflow-hidden selection:bg-pink-200"
    >
      {configError && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-white">
          <div className="max-w-md mx-auto text-center space-y-4 px-6">
            <div className="flex justify-center">
              <Mail className="text-pink-500" size={48} />
            </div>
            <h1 className="text-2xl font-bold text-pink-600">配置缺失</h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              糖果信箱需要正确的 Firebase 配置才能工作。请在部署环境中设置
              <code className="mx-1 px-1.5 py-0.5 rounded bg-pink-100 text-pink-700">VITE_FIREBASE_*</code>
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
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-4 border-pink-200 animate-bounce-in"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-pink-600 mb-3 flex items-center gap-2">
              <Info size={24} /> 如何发给朋友？
            </h3>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                <span className="font-bold text-gray-800">这是可以分享的正式链接！</span>
                <br />
                如果你是在 Vercel 上部署的，复制你浏览器地址栏的 `https://你的项目名.vercel.app` 网址即可。
              </p>
              <hr className="border-dashed border-pink-200" />
              <p className="bg-pink-50 p-2 rounded-lg text-pink-700 text-xs">温馨提示：主人的信箱暗号是 **520** 哦！</p>
            </div>
            <button
              onClick={() => setShowShareHelp(false)}
              className="w-full mt-5 bg-pink-500 text-white py-3 rounded-xl font-bold shadow-md hover:bg-pink-600 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      <div className="absolute top-10 left-10 text-pink-200 animate-bounce delay-700 select-none pointer-events-none">
        <Heart size={40} fill="currentColor" />
      </div>
      <div className="absolute bottom-20 right-10 text-purple-200 animate-pulse select-none pointer-events-none">
        <Candy size={50} />
      </div>

      <header className="w-full max-w-3xl p-4 md:p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-pink-100">
          <Mail className="text-pink-500" size={20} />
          <span className="font-bold text-pink-600 tracking-wider">糖果信箱</span>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={() => setView('write')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors shadow-sm ${
              view === 'write'
                ? 'bg-pink-500 text-white border-pink-500 shadow-lg'
                : 'bg-white/80 text-pink-500 border-pink-200 hover:bg-pink-50'
            }`}
          >
            <Sparkles size={18} />
            <span>写一封甜甜的信</span>
          </button>
          <button
            type="button"
            onClick={() => setView('read')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors shadow-sm ${
              view === 'read'
                ? 'bg-purple-500 text-white border-purple-500 shadow-lg'
                : 'bg-white/80 text-purple-500 border-purple-200 hover:bg-purple-50'
            }`}
          >
            <Mail size={18} />
            <span>看看大家的留言</span>
          </button>
          <button
            type="button"
            onClick={() => setShowShareHelp(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-amber-200 bg-amber-50/80 text-amber-600 hover:bg-amber-100 transition-colors shadow-sm"
          >
            <Share2 size={18} />
            <span>如何分享？</span>
          </button>
        </div>
      </header>

      <main className="w-full max-w-3xl px-4 pb-16 z-10">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-pink-100 p-6 md:p-10 relative overflow-hidden">
          <div className="absolute -top-10 -right-6 w-36 h-36 bg-pink-200/40 rounded-full blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-16 -left-10 w-40 h-40 bg-purple-200/40 rounded-full blur-3xl" aria-hidden="true" />

          {view === 'write' && (
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <Send className="text-pink-500" size={28} />
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-pink-600">写下你想说的悄悄话</h1>
                  <p className="text-sm text-gray-500 mt-1">留言会被放进主人的糖果信箱里，等 TA 来开启惊喜！</p>
                </div>
              </div>

              <form onSubmit={handleSend} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-pink-600 mb-2">你的昵称（可选）</label>
                  <input
                    value={senderName}
                    onChange={(event) => setSenderName(event.target.value)}
                    placeholder="写下你的名字或留空匿名"
                    className="w-full px-4 py-3 rounded-2xl border border-pink-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    maxLength={30}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-pink-600 mb-2">想对 TA 说的话</label>
                  <textarea
                    value={messageContent}
                    onChange={(event) => setMessageContent(event.target.value)}
                    placeholder="把心里话写下来，主人才看得到哦~"
                    className="w-full px-4 py-3 rounded-2xl border border-pink-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-pink-400 min-h-[160px]"
                    maxLength={600}
                  />
                  <p className="mt-2 text-xs text-gray-400">字数上限 600 字，支持换行～</p>
                </div>

                {showSuccess && (
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                    <Heart size={18} className="text-green-500" />
                    <span>甜甜的留言已投入信箱，感谢你的分享！</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 rounded-2xl shadow-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? '发送中...' : '发送这封糖果信'}
                </button>
              </form>
            </div>
          )}

          {view === 'read' && (
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                {isUnlocked ? <Unlock className="text-purple-500" size={28} /> : <Lock className="text-purple-500" size={28} />}
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-purple-600">打开信箱看看留言</h1>
                  <p className="text-sm text-gray-500 mt-1">输入主人设置的暗号后，才能看到大家留下的心意。</p>
                </div>
              </div>

              {!isUnlocked ? (
                <form onSubmit={handleUnlock} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-600 mb-2">输入暗号</label>
                    <input
                      type="password"
                      value={adminCode}
                      onChange={(event) => setAdminCode(event.target.value)}
                      placeholder="只有主人知道的小秘密"
                      className="w-full px-4 py-3 rounded-2xl border border-purple-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full flex justify-center items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-2xl shadow-lg transition-colors"
                  >
                    <Unlock size={18} />
                    <span>开启信箱</span>
                  </button>
                  <p className="text-xs text-gray-400 text-center">暗号对啦就能解锁，忘记的话去问问 TA 哦～</p>
                </form>
              ) : (
                <div className="space-y-5">
                  {messages.length === 0 ? (
                    <div className="text-center bg-white/70 border border-dashed border-purple-200 rounded-3xl py-16 px-6">
                      <Sparkles className="mx-auto text-purple-300 mb-4" size={32} />
                      <p className="text-gray-500">暂时还没有收到留言，快邀请朋友来写下第一封吧！</p>
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
                                <span className="text-base font-semibold text-gray-800">{msg.name || '匿名小可爱'}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge}`}>
                                  甜度 +{((msg.theme ?? 0) % cardThemes.length) + 1}
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
