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
  deleteDoc,
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

const GREEN = "#2e7d32";
const GREEN_LIGHT = "#e8f5e9";
const RED_LIGHT = "#ffebee";
const CARD = {
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #e8e8e8",
  padding: "16px 18px",
  marginBottom: 14,
};
const INPUT_STYLE = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 9,
  border: "1.5px solid #ddd",
  marginBottom: 12,
  marginTop: 4,
  boxSizing: "border-box",
  fontSize: 14,
  outline: "none",
};
const BTN_PRIMARY = {
  width: "100%",
  padding: "12px 0",
  background: GREEN,
  color: "#fff",
  border: "none",
  borderRadius: 9,
  cursor: "pointer",
  fontSize: 15,
  fontWeight: 600,
};
const LABEL_STYLE = { fontSize: 13, color: "#666", fontWeight: 500 };

const formatDate = (ts) => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatPKR = (n) => `PKR ${Math.abs(n).toLocaleString()}`;

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

  const [settlingHaari, setSettlingHaari] = useState(null);
  const [settleLoading, setSettleLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterHaari, setFilterHaari] = useState("all");

  useEffect(() => { emailjs.init(EMAILJS_PUBLIC_KEY); }, []);

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
      q = query(
        collection(db, "transactions"),
        where("landlordId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        collection(db, "transactions"),
        where("haariId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
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
        fullName, email, phone, role,
        landlordId: role === "haari" ? "" : null,
        createdAt: new Date(),
      });
    } catch (e) { setAuthError(e.message); }
  };

  const handleLogin = async () => {
    setAuthError(""); setResetSent(false);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { setAuthError("Invalid email or password"); }
  };

  const handleForgotPassword = async () => {
    if (!email) { setAuthError("Please enter your email first!"); return; }
    try { await sendPasswordResetEmail(auth, email); setResetSent(true); setAuthError(""); }
    catch (e) { setAuthError("Email not found!"); }
  };

  const handleLogout = async () => { await signOut(auth); setPage("home"); };

  const addHaari = async () => {
    setHaariError(""); setHaariSuccess("");
    if (!haariEmail) return;
    try {
      const q = query(collection(db, "users"), where("email", "==", haariEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) { setHaariError("No user found! Ask haari to sign up first."); return; }
      const haariDoc = snap.docs[0];
      if (haariDoc.data().role !== "haari") { setHaariError("This user is not registered as a Haari!"); return; }
      await setDoc(doc(db, "users", haariDoc.id), { landlordId: user.uid }, { merge: true });
      setHaariSuccess("Haari added successfully! 🎉");
      setHaariEmail("");
    } catch (e) { setHaariError("Something went wrong. Try again!"); }
  };

  const addTransaction = async () => {
    if (!from || !to || !amount) return;
    setTxnLoading(true); setTxnSuccess("");
    try {
      const haari = people.find((p) => p.fullName === to || p.fullName === from);
      await addDoc(collection(db, "transactions"), {
        from, to, amount: parseFloat(amount), crop, note,
        landlordId: user.uid,
        haariId: haari ? haari.id : "",
        createdAt: new Date(),
        isSettlement: false,
      });
      if (haari && haari.email) {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          haari_name: haari.fullName, haari_email: haari.email,
          landlord_name: userProfile.fullName,
          amount: parseFloat(amount).toLocaleString(), crop,
          note: note || "کوئی نوٹ نہیں / No note",
          date: new Date().toLocaleDateString("en-PK"),
        });
      }
      setTxnSuccess("✅ Transaction added & email sent!");
      setAmount(""); setNote(""); setFrom(""); setTo("");
    } catch (e) {
      setTxnSuccess("✅ Transaction added! (Email may have failed)");
    }
    setTxnLoading(false);
  };

  const handleDeleteTxn = async (id) => {
    try { await deleteDoc(doc(db, "transactions", id)); }
    catch (e) { alert("Could not delete. Try again."); }
    setDeleteConfirm(null);
  };

  const handleSettleUp = async (haari) => {
    const balance = getBalance(haari.fullName);
    if (balance === 0) { setSettlingHaari(null); return; }
    setSettleLoading(true);
    try {
      // balance > 0 means haari owes landlord → haari pays landlord
      // balance < 0 means landlord owes haari → landlord pays haari
      const payer = balance > 0 ? haari.fullName : userProfile.fullName;
      const receiver = balance > 0 ? userProfile.fullName : haari.fullName;
      await addDoc(collection(db, "transactions"), {
        from: payer,
        to: receiver,
        amount: Math.abs(balance),
        crop: "—",
        note: "✅ Settle Up / حساب برابر",
        landlordId: user.uid,
        haariId: haari.id,
        createdAt: new Date(),
        isSettlement: true,
      });
      setSettlingHaari(null);
    } catch (e) { alert("Could not settle. Try again."); }
    setSettleLoading(false);
  };

  // FIXED: landlord paid haari = haari owes MORE (positive = haari owes)
  const getBalance = (haariName) => {
    let balance = 0;
    transactions.forEach((t) => {
      if (t.to === haariName) balance += t.amount;   // landlord paid haari → haari owes
      if (t.from === haariName) balance -= t.amount; // haari paid back → reduces debt
    });
    return balance;
  };

  // FIXED: haari sees their own debt correctly
  const getHaariBalance = () => {
    let balance = 0;
    const myName = userProfile.fullName;
    transactions.forEach((t) => {
      if (t.to === myName) balance += t.amount;   // received money → owe more
      if (t.from === myName) balance -= t.amount; // paid back → less debt
    });
    return balance;
  };

  const filteredTxns =
    filterHaari === "all"
      ? transactions
      : transactions.filter((t) => {
          const h = people.find((p) => p.id === filterHaari);
          return h && (t.from === h.fullName || t.to === h.fullName);
        });

  // ── AUTH SCREEN ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 420, margin: "0 auto", padding: 16, background: "#f4f6f3", minHeight: "100vh" }}>
        <div style={{ background: GREEN, color: "#fff", padding: "20px 18px", borderRadius: 14, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>🌾</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>کسان ایپ / هاري ايپ</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.8 }}>English • اردو • سنڌي</p>
        </div>

        <div style={{ ...CARD, border: "none", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {["login", "signup"].map((p) => (
              <button key={p} onClick={() => { setAuthPage(p); setAuthError(""); setResetSent(false); }}
                style={{ flex: 1, padding: 10, background: authPage === p ? GREEN : "#fff", color: authPage === p ? "#fff" : "#333", border: `1.5px solid ${GREEN}`, borderRadius: 9, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                {p === "login" ? "Login / لاگ ان" : "Sign Up / رجسٹر"}
              </button>
            ))}
          </div>

          {authPage === "signup" && (<>
            <label style={LABEL_STYLE}>Full Name / پورا نام</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ali Khan" style={INPUT_STYLE} />
            <label style={LABEL_STYLE}>Phone / فون نمبر</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03001234567" style={INPUT_STYLE} />
            <label style={LABEL_STYLE}>Role / کردار</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={INPUT_STYLE}>
              <option value="landlord">🏠 Landlord / زمیندار</option>
              <option value="haari">🌾 Haari / هاري</option>
            </select>
          </>)}

          <label style={LABEL_STYLE}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" style={INPUT_STYLE} />
          <label style={LABEL_STYLE}>Password / پاسورڈ</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="minimum 6 characters" type="password" style={INPUT_STYLE} />

          {authError && <p style={{ color: "#c62828", fontSize: 13, marginBottom: 10 }}>⚠️ {authError}</p>}
          {resetSent && <p style={{ color: GREEN, fontSize: 13, marginBottom: 10 }}>✅ Reset link sent! Check your email.</p>}

          <button onClick={authPage === "login" ? handleLogin : handleSignUp} style={BTN_PRIMARY}>
            {authPage === "login" ? "✅ Login / لاگ ان" : "✅ Sign Up / رجسٹر"}
          </button>

          {authPage === "login" && (
            <p style={{ textAlign: "center", marginTop: 12 }}>
              <span onClick={handleForgotPassword} style={{ color: GREEN, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
                Forgot Password? / پاسورڈ بھول گئے؟
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN APP ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 490, margin: "0 auto", padding: "0 0 32px", background: "#f4f6f3", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: GREEN, color: "#fff", padding: "16px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>🌾 هاري ايپ</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.85 }}>
              {userProfile?.fullName} — {userProfile?.role === "landlord" ? "🏠 Landlord" : "🌾 Haari"}
            </p>
          </div>
          <button onClick={handleLogout} style={{ padding: "7px 14px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Logout
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ display: "flex", gap: 8, padding: "0 14px", marginBottom: 14 }}>
        {[
          { id: "home", label: "🏠 Home" },
          ...(userProfile?.role === "landlord" ? [{ id: "add", label: "+ لین دین" }] : []),
          { id: "balances", label: "📊 حساب" },
        ].map((tab) => (
          <button key={tab.id} onClick={() => { setPage(tab.id); setTxnSuccess(""); }}
            style={{ flex: 1, padding: "10px 6px", background: page === tab.id ? GREEN : "#fff", color: page === tab.id ? "#fff" : "#444", border: `1.5px solid ${page === tab.id ? GREEN : "#ddd"}`, borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: page === tab.id ? 600 : 400 }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 14px" }}>

        {/* ── HOME — Landlord ── */}
        {page === "home" && userProfile?.role === "landlord" && (
          <div>
            <div style={CARD}>
              <h3 style={{ marginTop: 0, color: GREEN, fontSize: 15, fontWeight: 600 }}>➕ Add Haari / هاري شامل ڪريو</h3>
              <input value={haariEmail} onChange={(e) => setHaariEmail(e.target.value)} placeholder="Haari's email address" style={INPUT_STYLE} />
              <button onClick={addHaari} style={BTN_PRIMARY}>✅ Add Haari / شامل ڪريو</button>
              {haariError && <p style={{ color: "#c62828", fontSize: 13, marginTop: 8 }}>⚠️ {haariError}</p>}
              {haariSuccess && <p style={{ color: GREEN, fontSize: 13, marginTop: 8 }}>{haariSuccess}</p>}
            </div>

            <div style={CARD}>
              <h3 style={{ marginTop: 0, color: GREEN, fontSize: 15, fontWeight: 600 }}>👥 My Haaris / میرے ہاری</h3>
              {people.length === 0 && <p style={{ color: "#aaa", textAlign: "center", fontSize: 14 }}>No haaris added yet</p>}
              {people.map((p) => {
                const bal = getBalance(p.fullName);
                return (
                  <div key={p.id} style={{ padding: "12px 14px", background: "#f9faf8", borderRadius: 10, marginBottom: 10, border: "1px solid #eee" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>🌾 {p.fullName}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#999" }}>{p.phone}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: bal > 0 ? "#c62828" : bal === 0 ? GREEN : "#1565c0" }}>
                          {bal > 0 ? `Owes ${formatPKR(bal)}` : bal === 0 ? "Clear ✅" : `You owe ${formatPKR(bal)}`}
                        </p>
                        {bal !== 0 && (
                          <button onClick={() => setSettlingHaari(p)}
                            style={{ marginTop: 6, padding: "5px 12px", background: "#fff", color: GREEN, border: `1.5px solid ${GREEN}`, borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                            💰 Settle Up
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HOME — Haari ── */}
        {page === "home" && userProfile?.role === "haari" && (
          <div style={CARD}>
            <h3 style={{ marginTop: 0, color: GREEN, fontSize: 15, fontWeight: 600 }}>📊 My Balance / منهنجو حساب</h3>
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ fontSize: 32, fontWeight: 700, color: getHaariBalance() > 0 ? "#c62828" : GREEN, margin: 0 }}>
                {getHaariBalance() > 0 ? "−" : "+"}{formatPKR(getHaariBalance())}
              </p>
              <p style={{ color: "#888", fontSize: 13, marginTop: 8 }}>
                {getHaariBalance() > 0
                  ? "⚠️ You owe this amount / آپ یہ رقم واجب الادا ہیں"
                  : getHaariBalance() === 0
                  ? "✅ All clear! / حساب برابر"
                  : "✅ You are in credit / آپ کا بیلنس مثبت ہے"}
              </p>
            </div>
          </div>
        )}

        {/* ── ADD TRANSACTION ── */}
        {page === "add" && userProfile?.role === "landlord" && (
          <div style={CARD}>
            <h3 style={{ marginTop: 0, color: GREEN, fontSize: 15, fontWeight: 600 }}>+ New Transaction / نیا لین دین</h3>

            {txnSuccess && (
              <div style={{ background: txnSuccess.includes("✅") ? GREEN_LIGHT : RED_LIGHT, padding: 12, borderRadius: 9, marginBottom: 14, textAlign: "center", fontSize: 14, color: txnSuccess.includes("✅") ? GREEN : "#c62828" }}>
                {txnSuccess}
              </div>
            )}

            <label style={LABEL_STYLE}>From — پیسے دینے والا</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)} style={INPUT_STYLE}>
              <option value="">Select</option>
              <option value={userProfile.fullName}>{userProfile.fullName} (You)</option>
              {people.map((p) => <option key={p.id}>{p.fullName}</option>)}
            </select>

            <label style={LABEL_STYLE}>To — پیسے لینے والا</label>
            <select value={to} onChange={(e) => setTo(e.target.value)} style={INPUT_STYLE}>
              <option value="">Select</option>
              <option value={userProfile.fullName}>{userProfile.fullName} (You)</option>
              {people.map((p) => <option key={p.id}>{p.fullName}</option>)}
            </select>

            <label style={LABEL_STYLE}>Amount / رقم — PKR</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 5000" style={INPUT_STYLE} />

            <label style={LABEL_STYLE}>Crop / فصل</label>
            <select value={crop} onChange={(e) => setCrop(e.target.value)} style={INPUT_STYLE}>
              {CROPS.map((c, i) => <option key={i}>{c}</option>)}
            </select>

            <label style={LABEL_STYLE}>Note / نوٹ (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. advance payment" style={{ ...INPUT_STYLE, marginBottom: 16 }} />

            <button onClick={addTransaction} disabled={txnLoading}
              style={{ ...BTN_PRIMARY, background: txnLoading ? "#aaa" : GREEN, cursor: txnLoading ? "not-allowed" : "pointer" }}>
              {txnLoading ? "⏳ Adding..." : "✅ Add Transaction / شامل کریں"}
            </button>
          </div>
        )}

        {/* ── BALANCES / TRANSACTIONS ── */}
        {page === "balances" && (
          <div>
            {userProfile?.role === "landlord" && people.length > 0 && (
              <div style={{ ...CARD, padding: "10px 14px" }}>
                <select value={filterHaari} onChange={(e) => setFilterHaari(e.target.value)}
                  style={{ ...INPUT_STYLE, marginBottom: 0, marginTop: 0, background: "#f9faf8" }}>
                  <option value="all">👥 All Haaris</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                </select>
              </div>
            )}

            <div style={CARD}>
              <h3 style={{ marginTop: 0, color: GREEN, fontSize: 15, fontWeight: 600 }}>📊 Transactions / لین دین</h3>
              {filteredTxns.length === 0 && <p style={{ color: "#aaa", textAlign: "center", fontSize: 14 }}>No transactions yet</p>}

              {filteredTxns.map((t) => {
                const isSettlement = t.isSettlement;
                return (
                  <div key={t.id} style={{
                    padding: "13px 14px",
                    background: isSettlement ? "#f0faf4" : "#f9faf8",
                    borderRadius: 10,
                    marginBottom: 10,
                    border: isSettlement ? "1px solid #a5d6a7" : "1px solid #eee",
                    position: "relative",
                  }}>
                    {userProfile?.role === "landlord" && (
                      <button onClick={() => setDeleteConfirm(t.id)}
                        style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#ccc", lineHeight: 1 }}>
                        🗑
                      </button>
                    )}
                    <div style={{ paddingRight: 24 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                        {t.from} ➡ {t.to}
                        {isSettlement && (
                          <span style={{ marginLeft: 8, fontSize: 11, background: "#c8e6c9", color: "#1b5e20", borderRadius: 5, padding: "2px 7px" }}>Settled</span>
                        )}
                      </p>
                      <p style={{ margin: "5px 0 0", fontSize: 13, color: "#555" }}>
                        💰 <strong>{formatPKR(t.amount)}</strong>
                        {t.crop && t.crop !== "—" && <span style={{ color: "#888" }}> &nbsp;|&nbsp; 🌾 {t.crop}</span>}
                      </p>
                      {t.note && (
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: isSettlement ? "#388e3c" : "#999" }}>
                          📝 {t.note}
                        </p>
                      )}
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#bbb" }}>
                        🗓 {formatDate(t.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── SETTLE UP MODAL ── */}
      {settlingHaari && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 22px", width: "100%", maxWidth: 360 }}>
            <h3 style={{ marginTop: 0, color: GREEN, fontSize: 16, fontWeight: 700 }}>💰 Settle Up / حساب برابر</h3>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
              This will record a settlement of{" "}
              <strong style={{ color: GREEN }}>{formatPKR(getBalance(settlingHaari.fullName))}</strong>{" "}
              to zero out <strong>{settlingHaari.fullName}</strong>'s balance.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setSettlingHaari(null)}
                style={{ flex: 1, padding: 11, background: "#fff", color: "#555", border: "1.5px solid #ddd", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={() => handleSettleUp(settlingHaari)} disabled={settleLoading}
                style={{ flex: 1, padding: 11, background: GREEN, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>
                {settleLoading ? "..." : "✅ Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 22px", width: "100%", maxWidth: 340 }}>
            <h3 style={{ marginTop: 0, color: "#c62828", fontSize: 16, fontWeight: 700 }}>🗑 Delete Transaction?</h3>
            <p style={{ fontSize: 14, color: "#555" }}>This cannot be undone. Are you sure?</p>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ flex: 1, padding: 11, background: "#fff", color: "#555", border: "1.5px solid #ddd", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={() => handleDeleteTxn(deleteConfirm)}
                style={{ flex: 1, padding: 11, background: "#c62828", color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>
                🗑 Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 24, color: "#bbb", fontSize: 12 }}>
        🌾 کسان ایپ — Kisan App — هاري ايپ
      </div>
    </div>
  );
}

export default App;