import { useState, useEffect, useRef } from "react";
import { socket } from "../socket";
import "./jaypardyTheme.css";

const DIFF_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard" };
const DIFF_COLORS = {
  easy:   { bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.45)",  text: "#86efac" },
  medium: { bg: "rgba(251,191,36,0.15)", border: "rgba(251,191,36,0.45)", text: "#fde68a" },
  hard:   { bg: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.45)",  text: "#fca5a5" },
};

function DiffButton({ value, selected, onSelect }) {
  const c = DIFF_COLORS[value];
  return (
    <button
      onClick={() => onSelect(selected === value ? null : value)}
      style={{
        padding: "6px 14px", borderRadius: 8,
        border: selected === value ? `2px solid ${c.border}` : "1px solid rgba(255,255,255,0.12)",
        background: selected === value ? c.bg : "rgba(255,255,255,0.04)",
        color: selected === value ? c.text : "rgba(246,247,255,0.4)",
        fontSize: 13, fontWeight: selected === value ? 900 : 600,
        cursor: "pointer", minWidth: 70, minHeight: 40,
      }}
    >
      {DIFF_LABELS[value]}
    </button>
  );
}

// ── Tab constants ─────────────────────────────────────────────────────────────
const TAB_CATEGORIES = "categories";
const TAB_CLUES      = "clues";
const TAB_THEMES     = "themes";

export default function EditorScreen() {
  // ── Categories state ──────────────────────────────────────────────────────
  const [categories,    setCategories]    = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [search,        setSearch]        = useState("");
  const [editingClue,   setEditingClue]   = useState(null);
  const [newCatName,    setNewCatName]    = useState("");
  const [showNewCat,    setShowNewCat]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [savedFlash,    setSavedFlash]    = useState(false);
  const [editingCatName, setEditingCatName] = useState(false);
  const [catNameDraft,   setCatNameDraft]   = useState("");
  const catNameInputRef = useRef(null);

  // ── Themes state ──────────────────────────────────────────────────────────
  const [themes,           setThemes]           = useState({});
  const [themeSearch,      setThemeSearch]       = useState("");
  const [editingTheme,     setEditingTheme]      = useState(null); // null | { name, categories[] }
  const [newThemeName,     setNewThemeName]      = useState("");
  const [showNewTheme,     setShowNewTheme]      = useState(false);
  const [confirmDelTheme,  setConfirmDelTheme]   = useState(null);
  const [themeNameDraft,   setThemeNameDraft]    = useState("");
  const [editingThemeName, setEditingThemeName]  = useState(false);
  const [themeCatSearch,   setThemeCatSearch]    = useState("");
  const [themeSavedFlash,  setThemeSavedFlash]   = useState(false);

  // ── Active tab ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(TAB_CATEGORIES);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    socket.emit("editor:getAll");
    socket.emit("host:getThemes");

    const onCatData   = (data)   => setCategories(data);
    const onThemeData = (themes) => setThemes(themes);

    socket.on("editor:data",   onCatData);
    socket.on("themes:update", onThemeData);

    return () => {
      socket.off("editor:data",   onCatData);
      socket.off("themes:update", onThemeData);
    };
  }, []);

  // ── Category helpers ──────────────────────────────────────────────────────
  const selectedCat  = categories.find((c) => c.category === selected);
  const filteredCats = categories.filter((c) =>
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  const flashSaved = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const flashThemeSaved = () => {
    setThemeSavedFlash(true);
    setTimeout(() => setThemeSavedFlash(false), 1800);
  };

  const saveClues = (newClues) => {
    if (!selected) return;
    socket.emit("editor:saveCategory", { name: selected, clues: newClues });
    flashSaved();
  };

  const handleRenameCategory = () => {
    const newName = catNameDraft.trim();
    if (!newName || newName === selected) { setEditingCatName(false); return; }
    socket.emit("editor:renameCategory", { oldName: selected, newName });
    setSelected(newName);
    setEditingCatName(false);
    flashSaved();
  };

  const startEditingCatName = () => {
    setCatNameDraft(selected);
    setEditingCatName(true);
    setTimeout(() => catNameInputRef.current?.focus(), 50);
  };

  const handleDiffChange = (clueIndex, diff) => {
    if (!selectedCat) return;
    const cleaned = selectedCat.clues.map((cl, i) => {
      const out  = { q: cl.q, a: cl.a };
      const newD = i === clueIndex ? diff : cl.d;
      if (newD) out.d = newD;
      return out;
    });
    saveClues(cleaned);
  };

  const handleSaveClue = () => {
    if (!editingClue || !selectedCat) return;
    const { q, a, d, index } = editingClue;
    if (!q?.trim() || !a?.trim()) return;
    const clueObj = { q: q.trim(), a: a.trim() };
    if (d) clueObj.d = d;
    const newClues = index === "new"
      ? [...selectedCat.clues, clueObj]
      : selectedCat.clues.map((cl, i) => i === index ? clueObj : cl);
    saveClues(newClues);
    setEditingClue(null);
  };

  const handleDeleteClue = (index) => {
    if (!selectedCat) return;
    saveClues(selectedCat.clues.filter((_, i) => i !== index));
  };

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    socket.emit("editor:saveCategory", { name: newCatName.trim(), clues: [] });
    setSelected(newCatName.trim());
    setNewCatName("");
    setShowNewCat(false);
    setActiveTab(TAB_CLUES);
  };

  const handleDeleteCategory = (name) => {
    socket.emit("editor:deleteCategory", { name });
    if (selected === name) { setSelected(null); setActiveTab(TAB_CATEGORIES); }
    setConfirmDelete(null);
  };

  const selectCategory = (name) => {
    setSelected(name);
    setEditingClue(null);
    setEditingCatName(false);
    setActiveTab(TAB_CLUES);
  };

  const diffStats = (clues) => {
    const e = clues.filter((c) => c.d === "easy").length;
    const m = clues.filter((c) => c.d === "medium").length;
    const h = clues.filter((c) => c.d === "hard").length;
    return { e, m, h, u: clues.length - e - m - h };
  };

  // ── Theme helpers ─────────────────────────────────────────────────────────
  const filteredThemes = Object.keys(themes).filter((n) =>
    n.toLowerCase().includes(themeSearch.toLowerCase())
  );

  const handleCreateTheme = () => {
    if (!newThemeName.trim()) return;
    // Start editing a new empty theme
    setEditingTheme({ name: newThemeName.trim(), categories: [] });
    setNewThemeName("");
    setShowNewTheme(false);
    setThemeCatSearch("");
    setEditingThemeName(false);
  };

  const handleSaveTheme = () => {
    if (!editingTheme) return;
    if (editingTheme.categories.length !== 6) return;
    socket.emit("host:saveTheme", { name: editingTheme.name, categories: editingTheme.categories });
    setEditingTheme(null);
    flashThemeSaved();
  };

  const handleDeleteTheme = (name) => {
    socket.emit("host:deleteTheme", { name });
    setConfirmDelTheme(null);
  };

  const handleRenameTheme = () => {
    if (!themeNameDraft.trim() || !editingTheme) return;
    const newName = themeNameDraft.trim();
    // Delete old, save new
    if (editingTheme.name !== newName) {
      socket.emit("host:deleteTheme", { name: editingTheme.name });
    }
    setEditingTheme((p) => ({ ...p, name: newName }));
    setEditingThemeName(false);
  };

  const toggleThemeCat = (catName) => {
    if (!editingTheme) return;
    const current = editingTheme.categories;
    if (current.includes(catName)) {
      setEditingTheme((p) => ({ ...p, categories: current.filter((c) => c !== catName) }));
    } else if (current.length < 6) {
      setEditingTheme((p) => ({ ...p, categories: [...current, catName] }));
    }
  };

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const tabs = [
    { id: TAB_CATEGORIES, label: "Categories" },
    { id: TAB_CLUES,      label: selected ? `${selected} (${selectedCat?.clues.length ?? 0})` : "Select Category", disabled: !selected },
    { id: TAB_THEMES,     label: "Themes" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#050a2a", color:"#f6f7ff", fontFamily:"ui-sans-serif, system-ui, sans-serif", display:"flex", flexDirection:"column" }}>

      {/* Top bar */}
      <header style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.25)", flexShrink:0 }}>
        <a href="/" style={{ padding:"8px 14px", borderRadius:10, fontSize:14, fontWeight:700, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.06)", color:"#f6f7ff", textDecoration:"none", flexShrink:0 }}>
          Back
        </a>
        <div style={{ fontWeight:900, color:"#ffdd75", fontSize:16, letterSpacing:1, flex:1, textAlign:"center" }}>
          CLUE EDITOR
        </div>
        <div style={{ fontSize:12, color:"rgba(246,247,255,0.4)", flexShrink:0 }}>
          {categories.length} cats · {Object.keys(themes).length} themes
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.08)", flexShrink:0, background:"rgba(0,0,0,0.15)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            style={{
              flex:1, padding:"13px", fontSize:13, fontWeight:700, border:"none",
              background: activeTab === tab.id ? "rgba(255,221,117,0.12)" : "transparent",
              color: activeTab === tab.id ? "#ffdd75" : tab.disabled ? "rgba(246,247,255,0.2)" : "rgba(246,247,255,0.45)",
              borderBottom: activeTab === tab.id ? "2px solid #ffdd75" : "2px solid transparent",
              cursor: tab.disabled ? "not-allowed" : "pointer",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

        {/* ════ CATEGORIES TAB ════ */}
        {activeTab === TAB_CATEGORIES && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories..."
                style={{ width:"100%", padding:"10px 14px", fontSize:15, borderRadius:10, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)", color:"#f6f7ff", outline:"none", boxSizing:"border-box", marginBottom:10 }} />
              {showNewCat ? (
                <div style={{ display:"flex", gap:8 }}>
                  <input autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()} placeholder="New category name..." maxLength={60}
                    style={{ flex:1, padding:"10px 14px", fontSize:15, borderRadius:10, border:"1px solid rgba(255,221,117,0.3)", background:"rgba(255,221,117,0.07)", color:"#f6f7ff", outline:"none" }} />
                  <button onClick={handleCreateCategory} disabled={!newCatName.trim()}
                    style={{ padding:"10px 18px", borderRadius:10, fontSize:15, fontWeight:900, border:"none", background: newCatName.trim() ? "#ffdd75" : "rgba(255,255,255,0.08)", color: newCatName.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: newCatName.trim() ? "pointer" : "not-allowed" }}>
                    Create
                  </button>
                  <button onClick={() => { setShowNewCat(false); setNewCatName(""); }}
                    style={{ padding:"10px 14px", borderRadius:10, fontSize:15, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(246,247,255,0.5)", cursor:"pointer" }}>
                    X
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowNewCat(true)}
                  style={{ width:"100%", padding:"13px", borderRadius:10, fontSize:15, fontWeight:700, border:"1px solid rgba(255,221,117,0.3)", background:"rgba(255,221,117,0.08)", color:"#ffdd75", cursor:"pointer" }}>
                  + New Category
                </button>
              )}
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"8px 10px" }}>
              {filteredCats.map((cat) => {
                const { e, m, h, u } = diffStats(cat.clues);
                return (
                  <div key={cat.category} onClick={() => selectCategory(cat.category)}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderRadius:12, marginBottom:6, background: selected === cat.category ? "rgba(255,221,117,0.12)" : "rgba(255,255,255,0.03)", border: selected === cat.category ? "1px solid rgba(255,221,117,0.35)" : "1px solid rgba(255,255,255,0.07)", cursor:"pointer" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:15, color: selected === cat.category ? "#ffdd75" : "#f6f7ff" }}>{cat.category}</div>
                      <div style={{ display:"flex", gap:8, marginTop:4, flexWrap:"wrap" }}>
                        <span style={{ fontSize:11, color:"rgba(246,247,255,0.4)" }}>{cat.clues.length} clues</span>
                        {e > 0 && <span style={{ fontSize:11, color:"#86efac" }}>{e} easy</span>}
                        {m > 0 && <span style={{ fontSize:11, color:"#fde68a" }}>{m} medium</span>}
                        {h > 0 && <span style={{ fontSize:11, color:"#fca5a5" }}>{h} hard</span>}
                        {u > 0 && <span style={{ fontSize:11, color:"rgba(246,247,255,0.3)" }}>{u} untagged</span>}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(cat.category); }}
                      style={{ width:44, height:44, borderRadius:10, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.07)", color:"rgba(239,68,68,0.6)", cursor:"pointer", fontSize:18, flexShrink:0 }}>
                      X
                    </button>
                    <div style={{ color:"rgba(246,247,255,0.3)", fontSize:22, flexShrink:0 }}>›</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ CLUES TAB ════ */}
        {activeTab === TAB_CLUES && selected && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.15)", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  {editingCatName ? (
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <input ref={catNameInputRef} value={catNameDraft} onChange={(e) => setCatNameDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameCategory(); if (e.key === "Escape") setEditingCatName(false); }}
                        maxLength={60}
                        style={{ flex:1, padding:"8px 12px", fontSize:16, fontWeight:900, borderRadius:8, border:"2px solid rgba(255,221,117,0.5)", background:"rgba(255,221,117,0.08)", color:"#ffdd75", outline:"none" }} />
                      <button onClick={handleRenameCategory} disabled={!catNameDraft.trim()}
                        style={{ padding:"8px 14px", borderRadius:8, fontSize:13, fontWeight:900, border:"none", background: catNameDraft.trim() ? "#ffdd75" : "rgba(255,255,255,0.08)", color: catNameDraft.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: catNameDraft.trim() ? "pointer" : "not-allowed", flexShrink:0 }}>
                        Save
                      </button>
                      <button onClick={() => setEditingCatName(false)}
                        style={{ padding:"8px 12px", borderRadius:8, fontSize:13, fontWeight:700, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(246,247,255,0.5)", cursor:"pointer", flexShrink:0 }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ fontWeight:900, fontSize:17, color:"#ffdd75" }}>{selected}</div>
                      <button onClick={startEditingCatName}
                        style={{ padding:"4px 10px", borderRadius:6, fontSize:12, fontWeight:700, border:"1px solid rgba(255,221,117,0.25)", background:"rgba(255,221,117,0.07)", color:"rgba(255,221,117,0.6)", cursor:"pointer", flexShrink:0 }}>
                        Rename
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize:12, color:"rgba(246,247,255,0.4)", marginTop:4 }}>{selectedCat?.clues.length ?? 0} clues</div>
                </div>
                {savedFlash && <div style={{ fontSize:13, fontWeight:700, color:"#21c55d", flexShrink:0 }}>Saved ✓</div>}
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {[["easy","#86efac","rows 1-2"],["medium","#fde68a","rows 3-4"],["hard","#fca5a5","row 5"]].map(([d,col,rows]) => (
                  <div key={d} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:col }} />
                    <span style={{ fontSize:11, color:col }}>{d} = {rows}</span>
                  </div>
                ))}
                <span style={{ fontSize:11, color:"rgba(246,247,255,0.3)" }}>· untagged = any row</span>
              </div>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"10px 12px" }}>
              {editingClue?.index !== "new" && (
                <button onClick={() => setEditingClue({ index:"new", q:"", a:"", d:null })}
                  style={{ width:"100%", padding:"14px", borderRadius:12, fontSize:15, fontWeight:700, border:"1px solid rgba(33,197,93,0.35)", background:"rgba(33,197,93,0.08)", color:"#21c55d", cursor:"pointer", marginBottom:10 }}>
                  + Add Clue
                </button>
              )}

              {editingClue?.index === "new" && (
                <div style={{ padding:"16px", borderRadius:14, marginBottom:10, background:"rgba(33,197,93,0.07)", border:"1px solid rgba(33,197,93,0.3)" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#21c55d", marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>New Clue</div>
                  <textarea autoFocus value={editingClue.q} onChange={(e) => setEditingClue((p) => ({ ...p, q: e.target.value }))} placeholder="The clue — written as a statement" rows={3}
                    style={{ width:"100%", padding:"10px 12px", fontSize:15, borderRadius:10, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)", color:"#f6f7ff", outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:8, fontFamily:"inherit" }} />
                  <input value={editingClue.a} onChange={(e) => setEditingClue((p) => ({ ...p, a: e.target.value }))} placeholder="Answer — e.g. What is the Super Bowl?"
                    style={{ width:"100%", padding:"10px 12px", fontSize:15, borderRadius:10, border:"1px solid rgba(255,221,117,0.25)", background:"rgba(255,221,117,0.06)", color:"#ffdd75", outline:"none", boxSizing:"border-box", marginBottom:12 }} />
                  <div style={{ fontSize:13, fontWeight:700, color:"rgba(246,247,255,0.6)", marginBottom:8 }}>Difficulty (optional)</div>
                  <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                    {["easy","medium","hard"].map((d) => (
                      <DiffButton key={d} value={d} selected={editingClue.d ?? null} onSelect={(val) => setEditingClue((p) => ({ ...p, d: val }))} />
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={handleSaveClue} disabled={!editingClue.q.trim() || !editingClue.a.trim()}
                      style={{ flex:1, padding:"14px", borderRadius:10, fontSize:15, fontWeight:900, border:"none", background: editingClue.q.trim() && editingClue.a.trim() ? "#21c55d" : "rgba(255,255,255,0.08)", color: editingClue.q.trim() && editingClue.a.trim() ? "#fff" : "rgba(255,255,255,0.3)", cursor: editingClue.q.trim() && editingClue.a.trim() ? "pointer" : "not-allowed" }}>
                      Save Clue
                    </button>
                    <button onClick={() => setEditingClue(null)}
                      style={{ padding:"14px 18px", borderRadius:10, fontSize:15, fontWeight:700, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(246,247,255,0.5)", cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {selectedCat?.clues.length === 0 && editingClue?.index !== "new" && (
                <div style={{ textAlign:"center", color:"rgba(246,247,255,0.3)", fontSize:14, padding:"40px 0" }}>
                  No clues yet — tap + Add Clue to get started.
                </div>
              )}

              {selectedCat?.clues.map((cl, i) => (
                <div key={i} style={{ borderRadius:12, marginBottom:8, border: editingClue?.index === i ? "1px solid rgba(255,221,117,0.4)" : "1px solid rgba(255,255,255,0.07)", background: editingClue?.index === i ? "rgba(255,221,117,0.06)" : "rgba(255,255,255,0.03)", overflow:"hidden" }}>
                  {editingClue?.index === i ? (
                    <div style={{ padding:"14px" }}>
                      <textarea autoFocus value={editingClue.q} onChange={(e) => setEditingClue((p) => ({ ...p, q: e.target.value }))} rows={3}
                        style={{ width:"100%", padding:"10px 12px", fontSize:15, borderRadius:10, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)", color:"#f6f7ff", outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:8, fontFamily:"inherit" }} />
                      <input value={editingClue.a} onChange={(e) => setEditingClue((p) => ({ ...p, a: e.target.value }))}
                        style={{ width:"100%", padding:"10px 12px", fontSize:15, borderRadius:10, border:"1px solid rgba(255,221,117,0.25)", background:"rgba(255,221,117,0.06)", color:"#ffdd75", outline:"none", boxSizing:"border-box", marginBottom:12 }} />
                      <div style={{ fontSize:13, fontWeight:700, color:"rgba(246,247,255,0.6)", marginBottom:8 }}>Difficulty</div>
                      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                        {["easy","medium","hard"].map((d) => (
                          <DiffButton key={d} value={d} selected={editingClue.d ?? null} onSelect={(val) => setEditingClue((p) => ({ ...p, d: val }))} />
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={handleSaveClue} disabled={!editingClue.q.trim() || !editingClue.a.trim()}
                          style={{ flex:1, padding:"12px", borderRadius:10, fontSize:14, fontWeight:900, border:"none", background: editingClue.q.trim() && editingClue.a.trim() ? "#ffdd75" : "rgba(255,255,255,0.08)", color: editingClue.q.trim() && editingClue.a.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: editingClue.q.trim() && editingClue.a.trim() ? "pointer" : "not-allowed" }}>
                          Save
                        </button>
                        <button onClick={() => setEditingClue(null)}
                          style={{ padding:"12px 16px", borderRadius:10, fontSize:14, fontWeight:700, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(246,247,255,0.5)", cursor:"pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding:"12px 14px" }}>
                      <div style={{ fontSize:14, color:"#f6f7ff", lineHeight:1.45, marginBottom:4 }}>
                        <span style={{ fontSize:11, fontWeight:900, color:"rgba(246,247,255,0.25)", marginRight:8 }}>{i + 1}</span>
                        {cl.q}
                      </div>
                      <div style={{ fontSize:13, color:"#ffdd75", fontStyle:"italic", marginBottom:12 }}>{cl.a}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        {["easy","medium","hard"].map((d) => (
                          <DiffButton key={d} value={d} selected={cl.d ?? null} onSelect={(val) => handleDiffChange(i, val)} />
                        ))}
                        <div style={{ flex:1 }} />
                        <button onClick={() => setEditingClue({ index:i, q:cl.q, a:cl.a, d:cl.d ?? null })}
                          style={{ padding:"8px 16px", minHeight:40, borderRadius:8, fontSize:13, fontWeight:700, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.06)", color:"rgba(246,247,255,0.7)", cursor:"pointer" }}>
                          Edit
                        </button>
                        <button onClick={() => handleDeleteClue(i)}
                          style={{ width:40, height:40, borderRadius:8, border:"1px solid rgba(239,68,68,0.25)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", cursor:"pointer", fontSize:16 }}>
                          X
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ height:40 }} />
            </div>
          </div>
        )}

        {/* ════ THEMES TAB ════ */}
        {activeTab === TAB_THEMES && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* ── Editing a theme ── */}
            {editingTheme ? (
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

                {/* Theme editor header */}
                <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.15)", flexShrink:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                    <div style={{ flex:1 }}>
                      {editingThemeName ? (
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <input autoFocus value={themeNameDraft} onChange={(e) => setThemeNameDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRenameTheme(); if (e.key === "Escape") setEditingThemeName(false); }}
                            maxLength={50}
                            style={{ flex:1, padding:"8px 12px", fontSize:16, fontWeight:900, borderRadius:8, border:"2px solid rgba(99,179,237,0.5)", background:"rgba(99,179,237,0.08)", color:"#90cdf4", outline:"none" }} />
                          <button onClick={handleRenameTheme} disabled={!themeNameDraft.trim()}
                            style={{ padding:"8px 14px", borderRadius:8, fontSize:13, fontWeight:900, border:"none", background: themeNameDraft.trim() ? "#90cdf4" : "rgba(255,255,255,0.08)", color: themeNameDraft.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: themeNameDraft.trim() ? "pointer" : "not-allowed", flexShrink:0 }}>
                            Save
                          </button>
                          <button onClick={() => setEditingThemeName(false)}
                            style={{ padding:"8px 12px", borderRadius:8, fontSize:13, fontWeight:700, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(246,247,255,0.5)", cursor:"pointer", flexShrink:0 }}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ fontWeight:900, fontSize:17, color:"#90cdf4" }}>{editingTheme.name}</div>
                          <button onClick={() => { setThemeNameDraft(editingTheme.name); setEditingThemeName(true); }}
                            style={{ padding:"4px 10px", borderRadius:6, fontSize:12, fontWeight:700, border:"1px solid rgba(99,179,237,0.25)", background:"rgba(99,179,237,0.07)", color:"rgba(99,179,237,0.6)", cursor:"pointer", flexShrink:0 }}>
                            Rename
                          </button>
                        </div>
                      )}
                      <div style={{ fontSize:12, color:"rgba(246,247,255,0.4)", marginTop:4 }}>
                        {editingTheme.categories.length} / 6 categories selected
                      </div>
                    </div>
                    {themeSavedFlash && <div style={{ fontSize:13, fontWeight:700, color:"#21c55d", flexShrink:0 }}>Saved ✓</div>}
                  </div>

                  {/* Selected categories pills */}
                  {editingTheme.categories.length > 0 && (
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                      {editingTheme.categories.map((c, i) => (
                        <div key={c} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:999, background:"rgba(99,179,237,0.15)", border:"1px solid rgba(99,179,237,0.35)", fontSize:12, fontWeight:700, color:"#90cdf4" }}>
                          <span style={{ opacity:0.5, marginRight:2 }}>{i+1}</span>
                          {c}
                          <button onClick={() => toggleThemeCat(c)} style={{ background:"none", border:"none", color:"rgba(99,179,237,0.6)", cursor:"pointer", padding:"0 0 0 4px", fontSize:14, lineHeight:1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display:"flex", gap:8 }}>
                    <button
                      onClick={handleSaveTheme}
                      disabled={editingTheme.categories.length !== 6}
                      style={{ flex:1, padding:"11px", borderRadius:10, fontSize:14, fontWeight:900, border:"none", background: editingTheme.categories.length === 6 ? "#90cdf4" : "rgba(255,255,255,0.08)", color: editingTheme.categories.length === 6 ? "#000" : "rgba(255,255,255,0.3)", cursor: editingTheme.categories.length === 6 ? "pointer" : "not-allowed" }}>
                      {editingTheme.categories.length === 6 ? "Save Theme" : `Need ${6 - editingTheme.categories.length} more`}
                    </button>
                    <button onClick={() => setEditingTheme(null)}
                      style={{ padding:"11px 16px", borderRadius:10, fontSize:14, fontWeight:700, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(246,247,255,0.5)", cursor:"pointer" }}>
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Category picker */}
                <div style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                  <input value={themeCatSearch} onChange={(e) => setThemeCatSearch(e.target.value)} placeholder="Search categories to add..."
                    style={{ width:"100%", padding:"10px 14px", fontSize:14, borderRadius:10, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)", color:"#f6f7ff", outline:"none", boxSizing:"border-box" }} />
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:"8px 10px" }}>
                  {categories
                    .filter((c) => c.category.toLowerCase().includes(themeCatSearch.toLowerCase()))
                    .map((cat) => {
                      const isSelected = editingTheme.categories.includes(cat.category);
                      const isFull     = editingTheme.categories.length >= 6 && !isSelected;
                      return (
                        <div key={cat.category} onClick={() => !isFull && toggleThemeCat(cat.category)}
                          style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderRadius:12, marginBottom:6, background: isSelected ? "rgba(99,179,237,0.12)" : "rgba(255,255,255,0.03)", border: isSelected ? "1px solid rgba(99,179,237,0.4)" : "1px solid rgba(255,255,255,0.07)", cursor: isFull ? "not-allowed" : "pointer", opacity: isFull ? 0.4 : 1 }}>
                          <div style={{ width:20, height:20, borderRadius:6, border: isSelected ? "2px solid #90cdf4" : "2px solid rgba(255,255,255,0.2)", background: isSelected ? "#90cdf4" : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:12, color:"#000", fontWeight:900 }}>
                            {isSelected && "✓"}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14, color: isSelected ? "#90cdf4" : "#f6f7ff" }}>{cat.category}</div>
                            <div style={{ fontSize:11, color:"rgba(246,247,255,0.35)", marginTop:2 }}>{cat.clues.length} clues</div>
                          </div>
                          {isSelected && (
                            <div style={{ fontSize:11, fontWeight:900, color:"#90cdf4", background:"rgba(99,179,237,0.15)", padding:"2px 8px", borderRadius:999 }}>
                              #{editingTheme.categories.indexOf(cat.category) + 1}
                            </div>
                          )}
                        </div>
                      );
                    })
                  }
                  <div style={{ height:40 }} />
                </div>
              </div>

            ) : (
              /* ── Theme list ── */
              <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
                  <input value={themeSearch} onChange={(e) => setThemeSearch(e.target.value)} placeholder="Search themes..."
                    style={{ width:"100%", padding:"10px 14px", fontSize:15, borderRadius:10, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)", color:"#f6f7ff", outline:"none", boxSizing:"border-box", marginBottom:10 }} />
                  {showNewTheme ? (
                    <div style={{ display:"flex", gap:8 }}>
                      <input autoFocus value={newThemeName} onChange={(e) => setNewThemeName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateTheme()} placeholder="Theme name..." maxLength={50}
                        style={{ flex:1, padding:"10px 14px", fontSize:15, borderRadius:10, border:"1px solid rgba(99,179,237,0.3)", background:"rgba(99,179,237,0.07)", color:"#f6f7ff", outline:"none" }} />
                      <button onClick={handleCreateTheme} disabled={!newThemeName.trim()}
                        style={{ padding:"10px 18px", borderRadius:10, fontSize:15, fontWeight:900, border:"none", background: newThemeName.trim() ? "#90cdf4" : "rgba(255,255,255,0.08)", color: newThemeName.trim() ? "#000" : "rgba(255,255,255,0.3)", cursor: newThemeName.trim() ? "pointer" : "not-allowed" }}>
                        Create
                      </button>
                      <button onClick={() => { setShowNewTheme(false); setNewThemeName(""); }}
                        style={{ padding:"10px 14px", borderRadius:10, fontSize:15, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"rgba(246,247,255,0.5)", cursor:"pointer" }}>
                        X
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewTheme(true)}
                      style={{ width:"100%", padding:"13px", borderRadius:10, fontSize:15, fontWeight:700, border:"1px solid rgba(99,179,237,0.3)", background:"rgba(99,179,237,0.08)", color:"#90cdf4", cursor:"pointer" }}>
                      + New Theme
                    </button>
                  )}
                </div>

                <div style={{ flex:1, overflowY:"auto", padding:"8px 10px" }}>
                  {filteredThemes.length === 0 && (
                    <div style={{ textAlign:"center", color:"rgba(246,247,255,0.3)", fontSize:14, padding:"40px 0" }}>
                      No themes yet — tap + New Theme to create one.
                    </div>
                  )}
                  {filteredThemes.map((name) => (
                    <div key={name} style={{ padding:"14px 16px", borderRadius:12, marginBottom:6, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                        <div style={{ fontWeight:700, fontSize:15, color:"#90cdf4", flex:1 }}>{name}</div>
                        <button
                          onClick={() => { setEditingTheme({ name, categories: [...themes[name]] }); setThemeCatSearch(""); setEditingThemeName(false); }}
                          style={{ padding:"6px 14px", borderRadius:8, fontSize:13, fontWeight:700, border:"1px solid rgba(99,179,237,0.3)", background:"rgba(99,179,237,0.10)", color:"#90cdf4", cursor:"pointer", flexShrink:0 }}>
                          Edit
                        </button>
                        <button onClick={() => setConfirmDelTheme(name)}
                          style={{ width:38, height:38, borderRadius:8, border:"1px solid rgba(239,68,68,0.2)", background:"rgba(239,68,68,0.07)", color:"rgba(239,68,68,0.6)", cursor:"pointer", fontSize:16, flexShrink:0 }}>
                          X
                        </button>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {themes[name].map((cat, i) => (
                          <div key={cat} style={{ fontSize:11, padding:"3px 8px", borderRadius:999, background:"rgba(99,179,237,0.10)", border:"1px solid rgba(99,179,237,0.2)", color:"rgba(99,179,237,0.7)", fontWeight:600 }}>
                            {i+1}. {cat}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ height:40 }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm delete category modal */}
      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:28, width:"100%", maxWidth:400, textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:900, color:"#fca5a5", marginBottom:10 }}>Delete Category?</div>
            <div style={{ fontSize:14, color:"rgba(246,247,255,0.6)", marginBottom:24, lineHeight:1.5 }}>
              <strong style={{ color:"#fff" }}>"{confirmDelete}"</strong> and all its clues will be permanently deleted.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding:"14px", borderRadius:12, fontSize:15, fontWeight:700, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)", color:"#f6f7ff", cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={() => handleDeleteCategory(confirmDelete)}
                style={{ padding:"14px", borderRadius:12, fontSize:15, fontWeight:900, border:"1px solid rgba(239,68,68,0.4)", background:"rgba(239,68,68,0.18)", color:"#fca5a5", cursor:"pointer" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete theme modal */}
      {confirmDelTheme && (
        <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:28, width:"100%", maxWidth:400, textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:900, color:"#fca5a5", marginBottom:10 }}>Delete Theme?</div>
            <div style={{ fontSize:14, color:"rgba(246,247,255,0.6)", marginBottom:24, lineHeight:1.5 }}>
              <strong style={{ color:"#fff" }}>"{confirmDelTheme}"</strong> will be permanently deleted.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <button onClick={() => setConfirmDelTheme(null)}
                style={{ padding:"14px", borderRadius:12, fontSize:15, fontWeight:700, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)", color:"#f6f7ff", cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={() => handleDeleteTheme(confirmDelTheme)}
                style={{ padding:"14px", borderRadius:12, fontSize:15, fontWeight:900, border:"1px solid rgba(239,68,68,0.4)", background:"rgba(239,68,68,0.18)", color:"#fca5a5", cursor:"pointer" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}