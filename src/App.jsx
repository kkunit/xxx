import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query
} from 'firebase/firestore';
import { 
  Heart, 
  Send, 
  Lock, 
  Mail, 
  Sparkles, 
  Candy, 
  Unlock,
  Share2,
  Info
} from 'lucide-react';

// --- IMPORTANT: Firebase Initialization ---
// Since we are deploying to a production environment (Vercel), 
// we MUST use environment variables for Firebase configuration.
// If you cannot use environment variables in your setup, 
// replace the `process.env.VITE_...` with the actual string values 
// you got from your Firebase project console.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const requiredFirebaseKeys = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];

const missingFirebaseKeys = requiredFirebaseKeys.filter((key) => {
  const value = firebaseConfig[key];
  return !value || value.toString().trim() === '';
});

export default function App() { // Renamed to App for the Vite structure
  const [firebaseServices, setFirebaseServices] = useState(null);
  const [firebaseError, setFirebaseError] = useState(null);
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

  // NOTE: In a real app, the SECRET_CODE should be stored securely, not in the frontend code.
  const SECRET_CODE = "520";

  const cardThemes = [
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
  ];

  const resolveTheme = (index = 0) => cardThemes[index % cardThemes.length];

  const uniqueAppId = firebaseServices?.projectId || 'default-app-id';

  // 0. Firebase Initialization
  useEffect(() => {
    if (missingFirebaseKeys.length > 0) {
      setFirebaseError(
        `缺少 Firebase 配置：${missingFirebaseKeys
          .map((key) => `VITE_FIREBASE_${key.toUpperCase()}`)
          .join(', ')}`
      );
      return;
    }

    try {
      const appInstance = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
      const authInstance = getAuth(appInstance);
      const dbInstance = getFirestore(appInstance);

      setFirebaseServices({
        app: appInstance,
        auth: authInstance,
        db: dbInstance,
        projectId: firebaseConfig.projectId
      });
      setFirebaseError(null);
    } catch (error) {
      console.error('Firebase 初始化失败:', error);
      setFirebaseError(error.message || 'Firebase 初始化失败，请检查环境变量设置。');
    }
  }, []);

  // 1. Auth Setup
  useEffect(() => {
    if (!firebaseServices?.auth) return;

    // In a real deployed app, Canvas global auth tokens (__initial_auth_token) are not available.
    // We sign in anonymously for public users, and rely on the UI to handle the admin login.
    const initAuth = async () => {
      try {
        // Attempt to sign in anonymously (default behavior for public users)
        await signInAnonymously(firebaseServices.auth);
      } catch (error) {
        console.error("Firebase Anonymous Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(firebaseServices.auth, setUser);
    return () => unsubscribe();
  }, [firebaseServices]);

  // 2. Data Fetching
  useEffect(() => {
    if (!firebaseServices?.db || !user || view !== 'read' || !isUnlocked) return;

    // Data stored in a public collection path using the unique project ID
    const q = query(collection(firebaseServices.db, 'artifacts', uniqueAppId, 'public', 'data', 'sugar_messages'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      msgs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setMessages(msgs);
    }, (error) => {
      console.error("Error fetching messages:", error);
    });

    return () => unsubscribe();
  }, [firebaseServices, user, view, isUnlocked, uniqueAppId]);

  // 3. Send Message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    if (!firebaseServices?.db || !firebaseServices?.auth) {
      alert("Firebase 尚未正确初始化，请稍后重试或检查配置。");
      return;
    }

    setLoading(true);
    try {
      let activeUser = user;
      if (!activeUser) {
        try {
          const credential = await signInAnonymously(firebaseServices.auth);
          activeUser = credential.user;
          setUser(credential.user);
        } catch (authError) {
          console.error("发送前尝试登录失败:", authError);
          alert("还在为你连接糖果信箱，请稍后再试一次哦～");
          return;
        }
      }

      await addDoc(collection(firebaseServices.db, 'artifacts', uniqueAppId, 'public', 'data', 'sugar_messages'), {
        name: senderName.trim() || '匿名小可爱',
        content: messageContent,
        timestamp: Date.now(),
        theme: Math.floor(Math.random() * 3)
      });
      
      setShowSuccess(true);
      setSenderName('');
      setMessageContent('');
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("发送遇到了一点小问题，请刷新后再试~");
    } finally {
      setLoading(false);
    }
  };

  // 4. Unlock Logic
  const handleUnlock = (e) => {
    e.preventDefault();
    if (adminCode === SECRET_CODE) {
      setIsUnlocked(true);
      setAdminCode('');
    } else {
      alert("暗号不对哦！");
    }
  };

  // --- UI Styles ---
  const bgStyle = {
    backgroundImage: `radial-gradient(#fbcfe8 1px, transparent 1px), radial-gradient(#fbcfe8 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 10px 10px',
    backgroundColor: '#fff1f2'
  };

  if (firebaseError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50 text-center px-6">
        <div className="bg-white/90 border border-pink-200 rounded-3xl shadow-xl max-w-lg w-full p-8 space-y-4">
          <h1 className="text-2xl font-bold text-pink-600">Firebase 配置缺失</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            应用无法连接到 Firebase，请检查 Vercel 或本地的环境变量设置后重新部署。
          </p>
          <p className="text-sm text-pink-500 break-all bg-pink-50 border border-dashed border-pink-200 rounded-2xl px-4 py-3">
            {firebaseError}
          </p>
          <p className="text-xs text-gray-400">
            需要的键名：VITE_FIREBASE_API_KEY、VITE_FIREBASE_AUTH_DOMAIN、VITE_FIREBASE_PROJECT_ID、
            VITE_FIREBASE_STORAGE_BUCKET、VITE_FIREBASE_MESSAGING_SENDER_ID、VITE_FIREBASE_APP_ID
          </p>
        </div>
      </div>
    );
  }

  if (!firebaseServices) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <div className="flex flex-col items-center gap-3 text-pink-500">
          <Mail size={32} className="animate-spin-slow" />
          <p className="text-sm">糖果信箱加载中，请稍候…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={bgStyle} className="min-h-screen w-full flex flex-col items-center font-sans text-slate-700 relative overflow-hidden selection:bg-pink-200">
      
      {/* Share Help Modal */}
      {showShareHelp && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowShareHelp(false)}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-4 border-pink-200 animate-bounce-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-pink-600 mb-3 flex items-center gap-2">
              <Info size={24} /> 如何发给朋友？
            </h3>
            <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
              <p>
                <span className="font-bold text-gray-800">这是可以分享的正式链接！</span><br/>
                如果你是在 Vercel 上部署的，复制你浏览器地址栏的 `https://你的项目名.vercel.app` 网址即可。
              </p>
              <hr className="border-dashed border-pink-200"/>
              <p className="bg-pink-50 p-2 rounded-lg text-pink-700 text-xs">
                温馨提示：主人的信箱暗号是 **520** 哦！
              </p>
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

      {/* Decorative Background Elements */}
      <div className="absolute top-10 left-10 text-pink-200 animate-bounce delay-700 select-none pointer-events-none">
        <Heart size={40} fill="currentColor" />
      </div>
      <div className="absolute bottom-20 right-10 text-purple-200 animate-pulse select-none pointer-events-none">
        <Candy size={50} />
      </div>

      {/* Header */}
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
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="写下你的名字或留空匿名"
                    className="w-full px-4 py-3 rounded-2xl border border-pink-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    maxLength={30}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-pink-600 mb-2">想对 TA 说的话</label>
                  <textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
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
                {isUnlocked ? (
                  <Unlock className="text-purple-500" size={28} />
                ) : (
                  <Lock className="text-purple-500" size={28} />
                )}
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
                      onChange={(e) => setAdminCode(e.target.value)}
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
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge}`}>甜度 +{(msg.theme ?? 0) % cardThemes.length + 1}</span>
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
