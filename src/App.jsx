import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Use the project ID as a unique identifier for data storage
const uniqueAppId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'default-app-id';

export default function App() { // Renamed to App for the Vite structure
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

  // 1. Auth Setup
  useEffect(() => {
    // In a real deployed app, Canvas global auth tokens (__initial_auth_token) are not available.
    // We sign in anonymously for public users, and rely on the UI to handle the admin login.
    const initAuth = async () => {
      try {
        // Attempt to sign in anonymously (default behavior for public users)
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Firebase Anonymous Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Data Fetching
  useEffect(() => {
    if (!user || view !== 'read' || !isUnlocked) return;

    // Data stored in a public collection path using the unique project ID
    const q = query(collection(db, 'artifacts', uniqueAppId, 'public', 'data', 'sugar_messages'));
    
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
  }, [user, view, isUnlocked, uniqueAppId]);

  // 3. Send Message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageContent.trim()) return;
    if (!user) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'artifacts', uniqueAppId, 'public', 'data', 'sugar_messages'), {
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
        
        <div className="flex gap-2">
          <bu
