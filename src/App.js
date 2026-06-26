import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import emailjs from "@emailjs/browser";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  doc,
  setDoc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import "./App.css";

const EMAILJS_SERVICE_ID = "service_n0wppp3";
const EMAILJS_TEMPLATE_ID = "template_uolqtoo";
const EMAILJS_PUBLIC_KEY = "iz4LiSjUVhclTBaKC";

const CROPS = [
  "گندم / ڪڻڪ (Wheat)",
  "چاول / چانور (Rice)",
  "گنا / ڪمند (Sugarcane)",
  "مکئی / مڪئي (Corn)",
  "کپاس / ڪپھ (Cotton)",
];

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authPage, setAuthPage] = useState("login");
  const [page, setPage] = useState("home");
  const [people, setPeople] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("landlord");
  const [authError, setAuthError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [crop, setCrop] = useState(CROPS[0]);
  const [note, setNote] = useState("");
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnSuccess, setTxnSuccess] = useState("");

  const [haariEmail, setHaariEmail] = useState("");
  const [haariError, setHaariError] = useState("");
  const [haariSuccess, setHaariSuccess] = useState("");

  useEffect(() => {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const docRef = doc(db, "users", firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserProfile(docSnap.data());
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || !userProfile) return;
    if (userProfile.role === "landlord") {
      const q = query(collection(db, "users"), where("landlordId", "==", user.uid));
      const unsub = onSnapshot(q, (snap) => {
        setPeople(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return unsub;
    }
  }, [user, userProfile]);

  useEffect(() => {
    if (!user || !userProfile) return;
    let q;
    if (userProfile.role === "landlord") {
      q = query(collection(db, "transactions"), where("landlordId", "==", user.uid), orderBy("createdAt"));
    } else {
      q = query(collection(db, "transactions"), where("haariId", "==", user.uid), orderBy("createdAt"));
    }
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user, userProfile]);

  const handleSignUp = async () => {
    setAuthError("");
    if (!fullName || !email || !password || !phone) {
      setAuthError("Please fill all fields");
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", cred.user.uid), {
        fullName,
        email,
        phone,
        role,
        landlordId: role === "haari" ? "" : null,
        createdAt: new Date(),
      });
    } catch (e) {
      setAuthError(e.message);
    }
  };

  const handleLogin = async () => {
    setAuthError("");
    setResetSent(false);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setAuthError("Invalid email or password");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError("Please enter your email first!");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setAuthError("");
    } catch (e) {
      setAuthError("Email not found!");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setPage("home");
  };

  const addHaari = async () => {
    setHaariError("");
    setHaariSuccess("");
    if (!haariEmail) return;
    try {
      const q = query(collection(db, "users"), where("email", "==", haariEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setHaariError("No user found! Ask haari to sign up first.");
        return;
      }
      const haariDoc = snap.docs[0];
      if (haariDoc.data().role !== "haari") {
        setHaariError("This user is not registered as a Haari!");
        return;
      }
      await setDoc(doc(db, "users", haariDoc.id), { landlordId: user.uid }, { merge: true });
      setHaariSuccess("Haari added successfully! 🎉");
      setHaariEmail("");
    } catch (e) {
      setHaariError("Something went wrong. Try again!");
    }
  };

  const addTransaction = async () => {
    if (!from || !to || !amount) return;
    setTxnLoading(true);
    setTxnSuccess("");
    try {
      const haari = people.find((p) => p.fullName === to || p.fullName === from);
      await addDoc(collection(db, "transactions"), {
        from,
        to,
        amount: parseFloat(amount),
        crop,
        note,
        landlordId: user.uid,
        haariId: haari ? haari.id : "",
        createdAt: new Date(),
      });

      // Send email to haari
      if (haari && haari.email) {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          haari_name: haari.fullName,
          haari_email: haari.email,
          landlord_name: userProfile.fullName,
          amount: parseFloat(amount).toLocaleString(),
          crop: crop,
          note: note || "کوئی نوٹ نہیں / No note",
          date: new Date().toLocaleDateString("en-PK"),
        });
      }

      setTxnSuccess("✅ Transaction added & email sent! / لین دین شامل اور ای میل بھیج دی!");
      setAmount("");
      setNote("");
      setFrom("");
      setTo("");
    } catch (e) {
      setTxnSuccess("✅ Transaction added! (Email may have failed)");
    }
    setTxnLoading(false);
  };

  const getBalance = (name) => {
    let balance = 0;
    transactions.forEach((t) => {
      if (t.from === name) balance += t.amount;
      if (t.to === name) balance -= t.amount;
    });
    return balance;
  };

  const getHaariBalance = () => {
    let balance = 0;
    transactions.forEach((t) => {
      if (t.to === userProfile.fullName) balance -= t.amount;
      if (t.from === userProfile.fullName) balance += t.amount;
    });
    return balance;
  };

  if (!user) {
    return (
      <div style={{ fontFamily: "Arial", maxWidth: 420, margin: "0 auto", padding: 16, background: "#f5f5f5", minHeight: "100vh" }}>
        <div style={{ background: "#2e7d32", color: "white", padding: 16, borderRadius: 12, marginBottom: 20, textAlign: "center" }}>
          <h2 style={{ margin: 0 }}>🌾 کسان ایپ / هاري ايپ</h2>
          <p style={{ margin: 4, fontSize: 13 }}>Kisan Finance App</p>
          <p style={{ margin: 0, fontSize: 11, opacity: 0.85 }}>English • اردو • سنڌي</p>
        </div>

        <div style={{ background: "#fff", padding: 20, borderRadius: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button onClick={() => { setAuthPage("login"); setAuthError(""); setResetSent(false); }} style={{ flex: 1, padding: 10, background: authPage === "login" ? "#2e7d32" : "#fff", color: authPage === "login" ? "#fff" : "#333", border: "1px solid #2e7d32", borderRadius: 8, cursor: "pointer" }}>
              Login / لاگ ان
            </button>
            <button onClick={() => { setAuthPage("signup"); setAuthError(""); setResetSent(false); }} style={{ flex: 1, padding: 10, background: authPage === "signup" ? "#2e7d32" : "#fff", color: authPage === "signup" ? "#fff" : "#333", border: "1px solid #2e7d32", borderRadius: 8, cursor: "pointer" }}>
              Sign Up / رجسٹر
            </button>
          </div>

          {authPage === "signup" && (
            <>
              <label style={{ fontSize: 13, color: "#555" }}>Full Name / پورا نام</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ali Khan" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10, marginTop: 4, boxSizing: "border-box" }} />
              <label style={{ fontSize: 13, color: "#555" }}>Phone / فون نمبر</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 03001234567" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10, marginTop: 4, boxSizing: "border-box" }} />
              <label style={{ fontSize: 13, color: "#555" }}>Role / کردار</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10, marginTop: 4 }}>
                <option value="landlord">🏠 Landlord / زمیندار</option>
                <option value="haari">🌾 Haari / هاري</option>
              </select>
            </>
          )}

          <label style={{ fontSize: 13, color: "#555" }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 10, marginTop: 4, boxSizing: "border-box" }} />
          <label style={{ fontSize: 13, color: "#555" }}>Password / پاسورڈ</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="minimum 6 characters" type="password" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 16, marginTop: 4, boxSizing: "border-box" }} />

          {authError && <p style={{ color: "red", fontSize: 13, marginBottom: 10 }}>⚠️ {authError}</p>}
          {resetSent && <p style={{ color: "green", fontSize: 13, marginBottom: 10 }}>✅ Reset link sent! Check your email.</p>}

          <button onClick={authPage === "login" ? handleLogin : handleSignUp} style={{ width: "100%", padding: 12, background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>
            {authPage === "login" ? "✅ Login / لاگ ان" : "✅ Sign Up / رجسٹر"}
          </button>

          {authPage === "login" && (
            <p style={{ textAlign: "center", marginTop: 12 }}>
              <span onClick={handleForgotPassword} style={{ color: "#2e7d32", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
                Forgot Password? / پاسورڈ بھول گئے؟
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Arial", maxWidth: 480, margin: "0 auto", padding: 16, background: "#f5f5f5", minHeight: "100vh" }}>
      <div style={{ background: "#2e7d32", color: "white", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>🌾 هاري ايپ</h2>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>
              {userProfile?.fullName} — {userProfile?.role === "landlord" ? "🏠 Landlord" : "🌾 Haari"}
            </p>
          </div>
          <button onClick={handleLogout} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setPage("home")} style={{ flex: 1, padding: 10, background: page === "home" ? "#2e7d32" : "#fff", color: page === "home" ? "#fff" : "#333", border: "1px solid #2e7d32", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>🏠 Home</button>
        {userProfile?.role === "landlord" && (
          <button onClick={() => { setPage("add"); setTxnSuccess(""); }} style={{ flex: 1, padding: 10, background: page === "add" ? "#2e7d32" : "#fff", color: page === "add" ? "#fff" : "#333", border: "1px solid #2e7d32", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>+ لین دین</button>
        )}
        <button onClick={() => setPage("balances")} style={{ flex: 1, padding: 10, background: page === "balances" ? "#2e7d32" : "#fff", color: page === "balances" ? "#fff" : "#333", border: "1px solid #2e7d32", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>📊 حساب</button>
      </div>

      {page === "home" && userProfile?.role === "landlord" && (
        <div>
          <div style={{ background: "#fff", padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, color: "#2e7d32" }}>➕ Add Haari / هاري شامل ڪريو</h3>
            <input value={haariEmail} onChange={(e) => setHaariEmail(e.target.value)} placeholder="Haari's email address" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 8, boxSizing: "border-box" }} />
            <button onClick={addHaari} style={{ width: "100%", padding: 10, background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
              ✅ Add Haari / شامل ڪريو
            </button>
            {haariError && <p style={{ color: "red", fontSize: 13, marginTop: 8 }}>⚠️ {haariError}</p>}
            {haariSuccess && <p style={{ color: "green", fontSize: 13, marginTop: 8 }}>✅ {haariSuccess}</p>}
          </div>

          <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
            <h3 style={{ marginTop: 0, color: "#2e7d32" }}>👥 My Haaris / میرے ہاری</h3>
            {people.length === 0 && <p style={{ color: "#999", textAlign: "center" }}>No haaris added yet</p>}
            {people.map((p) => (
              <div key={p.id} style={{ padding: 12, background: "#f9f9f9", borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                <span>🌾 {p.fullName}<br /><span style={{ fontSize: 12, color: "#888" }}>{p.phone}</span></span>
                <span style={{ color: getBalance(p.fullName) >= 0 ? "red" : "green", fontWeight: "bold" }}>
                  {getBalance(p.fullName) >= 0 ? "-" : "+"}PKR {Math.abs(getBalance(p.fullName)).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {page === "home" && userProfile?.role === "haari" && (
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0, color: "#2e7d32" }}>📊 My Balance / منهنجو حساب</h3>
          <div style={{ textAlign: "center", padding: 20 }}>
            <p style={{ fontSize: 28, fontWeight: "bold", color: getHaariBalance() <= 0 ? "red" : "green" }}>
              {getHaariBalance() <= 0 ? "-" : "+"}PKR {Math.abs(getHaariBalance()).toLocaleString()}
            </p>
            <p style={{ color: "#888", fontSize: 13 }}>
              {getHaariBalance() <= 0 ? "⚠️ You owe this amount / آپ یہ رقم واجب الادا ہیں" : "✅ You are in credit / آپ کا بیلنس مثبت ہے"}
            </p>
          </div>
        </div>
      )}

      {page === "add" && userProfile?.role === "landlord" && (
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0, color: "#2e7d32" }}>+ New Transaction / نیا لین دین</h3>

          {txnSuccess && (
            <div style={{ background: txnSuccess.includes("✅") ? "#e8f5e9" : "#ffebee", padding: 12, borderRadius: 8, marginBottom: 16, textAlign: "center", fontSize: 14, color: txnSuccess.includes("✅") ? "#2e7d32" : "red" }}>
              {txnSuccess}
            </div>
          )}

          <label style={{ fontSize: 13, color: "#555" }}>From — پیسے دینے والا</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12, marginTop: 4 }}>
            <option value="">Select</option>
            <option value={userProfile.fullName}>{userProfile.fullName} (You)</option>
            {people.map((p) => <option key={p.id}>{p.fullName}</option>)}
          </select>

          <label style={{ fontSize: 13, color: "#555" }}>To — پیسے لینے والا</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12, marginTop: 4 }}>
            <option value="">Select</option>
            <option value={userProfile.fullName}>{userProfile.fullName} (You)</option>
            {people.map((p) => <option key={p.id}>{p.fullName}</option>)}
          </select>

          <label style={{ fontSize: 13, color: "#555" }}>Amount / رقم — PKR</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12, marginTop: 4, boxSizing: "border-box" }} />

          <label style={{ fontSize: 13, color: "#555" }}>Crop / فصل</label>
          <select value={crop} onChange={(e) => setCrop(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12, marginTop: 4 }}>
            {CROPS.map((c, i) => <option key={i}>{c}</option>)}
          </select>

          <label style={{ fontSize: 13, color: "#555" }}>Note / نوٹ (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. advance payment" style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 16, marginTop: 4, boxSizing: "border-box" }} />

          <button onClick={addTransaction} disabled={txnLoading} style={{ width: "100%", padding: 12, background: txnLoading ? "#888" : "#2e7d32", color: "#fff", border: "none", borderRadius: 8, cursor: txnLoading ? "not-allowed" : "pointer", fontSize: 15 }}>
            {txnLoading ? "⏳ Adding... / شامل ہو رہا ہے..." : "✅ Add Transaction / شامل کریں"}
          </button>
        </div>
      )}

      {page === "balances" && (
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0, color: "#2e7d32" }}>📊 Transactions / لین دین</h3>
          {transactions.length === 0 && <p style={{ color: "#999", textAlign: "center" }}>No transactions yet</p>}
          {transactions.map((t) => (
            <div key={t.id} style={{ padding: 12, background: "#f9f9f9", borderRadius: 8, marginBottom: 8, fontSize: 14 }}>
              <strong>{t.from}</strong> ➡ <strong>{t.to}</strong><br />
              💰 PKR {t.amount?.toLocaleString()} &nbsp;|&nbsp; 🌾 {t.crop}
              {t.note && <><br /><span style={{ color: "#888" }}>📝 {t.note}</span></>}
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 24, color: "#aaa", fontSize: 12 }}>
        🌾 کسان ایپ — Kisan App — هاري ايپ
      </div>
    </div>
  );
}

export default App;