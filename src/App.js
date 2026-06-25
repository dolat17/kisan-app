import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import "./App.css";

const CROPS = [
  "گندم / ڪڻڪ (Wheat)",
  "چاول / چانور (Rice)",
  "گنا / ڪمند (Sugarcane)",
  "مکئی / مڪئي (Corn)",
  "کپاس / ڪپھ (Cotton)",
];

function App() {
  const [page, setPage] = useState("home");
  const [people, setPeople] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [crop, setCrop] = useState(CROPS[0]);
  const [note, setNote] = useState("");

  // Load people from Firebase
  useEffect(() => {
    const q = query(collection(db, "people"), orderBy("createdAt"));
    const unsub = onSnapshot(q, (snapshot) => {
      setPeople(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  // Load transactions from Firebase
  useEffect(() => {
    const q = query(collection(db, "transactions"), orderBy("createdAt"));
    const unsub = onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  const addPerson = async () => {
    if (name.trim() === "") return;
    await addDoc(collection(db, "people"), {
      name: name.trim(),
      createdAt: new Date(),
    });
    setName("");
  };

  const addTransaction = async () => {
    if (!from || !to || !amount) return;
    await addDoc(collection(db, "transactions"), {
      from,
      to,
      amount: parseFloat(amount),
      crop,
      note,
      createdAt: new Date(),
    });
    setAmount("");
    setNote("");
  };

  const getBalance = (personName) => {
    let balance = 0;
    transactions.forEach((t) => {
      if (t.from === personName) balance -= t.amount;
      if (t.to === personName) balance += t.amount;
    });
    return balance;
  };

  return (
    <div style={{ fontFamily: "Arial", maxWidth: 480, margin: "0 auto", padding: 16, background: "#f5f5f5", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: "#2e7d32", color: "white", padding: 16, borderRadius: 12, marginBottom: 16, textAlign: "center" }}>
        <h2 style={{ margin: 0 }}>🌾 کسان ایپ / هاري ايپ</h2>
        <p style={{ margin: 4, fontSize: 13 }}>Kisan Finance App</p>
        <p style={{ margin: 0, fontSize: 11, opacity: 0.85 }}>English • اردو • سنڌي</p>
      </div>

      {/* Nav Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setPage("home")} style={{ flex: 1, padding: 10, background: page === "home" ? "#2e7d32" : "#fff", color: page === "home" ? "#fff" : "#333", border: "1px solid #2e7d32", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          🏠 Home
        </button>
        <button onClick={() => setPage("add")} style={{ flex: 1, padding: 10, background: page === "add" ? "#2e7d32" : "#fff", color: page === "add" ? "#fff" : "#333", border: "1px solid #2e7d32", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          + لین دین
        </button>
        <button onClick={() => setPage("balances")} style={{ flex: 1, padding: 10, background: page === "balances" ? "#2e7d32" : "#fff", color: page === "balances" ? "#fff" : "#333", border: "1px solid #2e7d32", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          📊 حساب
        </button>
      </div>

      {/* Home Page */}
      {page === "home" && (
        <div>
          <div style={{ background: "#fff", padding: 16, borderRadius: 12, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, color: "#2e7d32" }}>
              👤 Add Person
              <span style={{ fontSize: 13, fontWeight: "normal", display: "block", color: "#555" }}>
                شخص شامل کریں / ماڻھو شامل ڪريو
              </span>
            </h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPerson()}
              placeholder="Name / نام / نالو (e.g. Ali, Zamindar)"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 8, boxSizing: "border-box", fontSize: 14 }}
            />
            <button onClick={addPerson} style={{ width: "100%", padding: 10, background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>
              ✅ Add Person / شامل ڪريو
            </button>
          </div>

          <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
            <h3 style={{ marginTop: 0, color: "#2e7d32" }}>
              👥 People / لوگ / ماڻھو
            </h3>
            {people.length === 0 && (
              <p style={{ color: "#999", textAlign: "center" }}>
                No people added yet<br />
                <span style={{ fontSize: 12 }}>ابھی کوئی نہیں / اڃا ڪو نه</span>
              </p>
            )}
            {people.map((p) => (
              <div key={p.id} style={{ padding: 12, background: "#f9f9f9", borderRadius: 8, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>👤 {p.name}</span>
                <span style={{ color: getBalance(p.name) >= 0 ? "green" : "red", fontWeight: "bold" }}>
                  {getBalance(p.name) >= 0 ? "+" : ""}PKR {getBalance(p.name).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Transaction Page */}
      {page === "add" && (
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0, color: "#2e7d32" }}>
            + New Transaction
            <span style={{ fontSize: 13, fontWeight: "normal", display: "block", color: "#555" }}>
              نیا لین دین / نئون ڏيڻ وٺڻ
            </span>
          </h3>

          <label style={{ fontSize: 13, color: "#555" }}>From — پیسے دینے والا / ڏيندڙ</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12, marginTop: 4 }}>
            <option value="">Select / چنیں / چونڊيو</option>
            {people.map((p) => <option key={p.id}>{p.name}</option>)}
          </select>

          <label style={{ fontSize: 13, color: "#555" }}>To — پیسے لینے والا / وٺندڙ</label>
          <select value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12, marginTop: 4 }}>
            <option value="">Select / چنیں / چونڊيو</option>
            {people.map((p) => <option key={p.id}>{p.name}</option>)}
          </select>

          <label style={{ fontSize: 13, color: "#555" }}>Amount / رقم / رقم — PKR</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 5000"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12, marginTop: 4, boxSizing: "border-box" }}
          />

          <label style={{ fontSize: 13, color: "#555" }}>Crop / فصل / فصل</label>
          <select value={crop} onChange={(e) => setCrop(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 12, marginTop: 4 }}>
            {CROPS.map((c, i) => <option key={i}>{c}</option>)}
          </select>

          <label style={{ fontSize: 13, color: "#555" }}>Note / نوٹ / نوٽ (optional)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. advance payment / پیشگی ادائیگی"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc", marginBottom: 16, marginTop: 4, boxSizing: "border-box" }}
          />

          <button onClick={addTransaction} style={{ width: "100%", padding: 12, background: "#2e7d32", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>
            ✅ Add Transaction / شامل ڪريو
          </button>
        </div>
      )}

      {/* Balances Page */}
      {page === "balances" && (
        <div style={{ background: "#fff", padding: 16, borderRadius: 12 }}>
          <h3 style={{ marginTop: 0, color: "#2e7d32" }}>
            📊 Balances / حساب / حساب
          </h3>
          {transactions.length === 0 && (
            <p style={{ color: "#999", textAlign: "center" }}>
              No transactions yet<br />
              <span style={{ fontSize: 12 }}>ابھی کوئی لین دین نہیں / اڃا ڪو ڏيڻ وٺڻ نه</span>
            </p>
          )}
          {transactions.map((t) => (
            <div key={t.id} style={{ padding: 12, background: "#f9f9f9", borderRadius: 8, marginBottom: 8, fontSize: 14 }}>
              <strong>{t.from}</strong> ➡ <strong>{t.to}</strong>
              <br />
              💰 PKR {t.amount.toLocaleString()} &nbsp;|&nbsp; 🌾 {t.crop}
              {t.note && <><br /><span style={{ color: "#888" }}>📝 {t.note}</span></>}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: 24, color: "#aaa", fontSize: 12 }}>
        🌾 کسان ایپ — Kisan App — هاري ايپ
      </div>
    </div>
  );
}

export default App;