import { useState, useEffect } from "react";
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
        padding:      "6px 14px",
        borderRadius: 8,
        border:       selected === value ? `2px solid ${c.border}` : "1px solid rgba(255,255,255,0.12)",
        background:   selected === value ? c.bg : "rgba(255,255,255,0.04)",
        color:        selected === value ? c.text : "rgba(246,247,255,0.4)",
        fontSize:     13,
        fontWeight:   selected === value ? 900 : 600,
        cursor:       "pointer",
        minWidth:     70,
        minHeight:    40,
      }}
    >
      {DIFF_LABELS[value]}
    </button>
  );
}

export default function EditorScreen() {
  const [categories,    setCategories]    = useState([]);
  const [selected,      setSelected]      = useState(null);
  const [search,        setSearch]        = useState("");
  const [editingClue,   setEditingClue]   = useState(null);
  const [newCatName,    setNewCatName]    = useState("");
  const [showNewCat,    setShowNewCat]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [savedFlash,    setSavedFlash]    = useState(false);
  const [showCatList,   setShowCatList]   = useState(true);

  useEffect(() => {
    socket.emit("editor:getAll");
    const onData = (data) => setCategories(data);
    socket.on("editor:data", onData);
    return () => socket.off("editor:data", onData);
  }, []);

  const selectedCat  = categories.find((c) => c.category === selected);
  const filteredCats = categories.filter((c) =>
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  const flashSaved = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const saveClues = (newClues) => {
    if (!selected) return;
    socket.emit("editor:saveCategory", { name: selected, clues: newClues });
    flashSaved();
  };

  const handleDiffChange = (clueIndex, diff) => {
    if (!selectedCat) return;
    const cleaned = selectedCat.clues.map((cl, i) => {
      const out = { q: cl.q, a: cl.a };
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
    let newClues;
    if (index === "new") {
      newClues = [...selectedCat.clues, clueObj];
    } else {
      newClues = selectedCat.clues.map((cl, i) => i === index ? clueObj : cl);
    }
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
    setShowCatList(false);
  };

  const handleDeleteCategory = (name) => {
    socket.emit("editor:deleteCategory", { name });
    if (selected === name) setSelected(null);
    setConfirmDelete(null);
  };

  const selectCategory = (name) => {
    setSelected(name);
    setEditingClue(null);
    setShowCatList(false);
  };

  const diffStats = (clues) => {
    const e = clues.filter((c) => c.d === "easy").length;
    const m = clues.filter((c) => c.d === "medium").length;
    const h = clues.filter((c) => c.d === "hard").length;
    const u = clues.length - e - m - h;
    return { e, m, h, u };
  };

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
          {categories.length} categories
        </div>
      </header>

      {/* Tab bar */}
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.08)", flexShrink:0, background:"rgba(0,0,0,0.15)" }}>
        <button onClick={() => setShowCatList(true)} style={{ flex:1, padding:"13px", fontSize:14, fontWeight:700, border:"none", background: showCatList ? "rgba(255,221,117,0.12)" : "transparent", color: showCatList ? "#ffdd75" : "rgba(246,247,255,0.45)", borderBottom: showCatList ? "2px solid #ffdd75" : "2px solid transparent", cursor:"pointer" }}>
          Categories
        </button>
        <button onClick={() => selected && setShowCatList(false)} disabled={!selected} style={{ flex:1, padding:"13px", fontSize:14, fontWeight:700, border:"none", background: !showCatList ? "rgba(255,221,117,0.12)" : "transparent", color: !showCatList ? "#ffdd75" : selected ? "rgba(246,247,255,0.45)" : "rgba(246,247,255,0.2)", borderBottom: !showCatList ? "2px solid #ffdd75" : "2px solid transparent", cursor: selected ? "pointer" : "not-allowed" }}>
          {selected ? `${selected} (${selectedCat?.clues.length ?? 0})` : "Select a category"}
        </button>
      </div>

      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

        {/* ── Category list ── */}
        {showCatList && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                style={{ width:"100%", padding:"10px 14px", fontSize:15, borderRadius:10, border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)", color:"#f6f7ff", outline:"none", boxSizing:"border-box", marginBottom:10 }}
              />
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
                  <div key={cat.category} onClick={() => selectCategory(cat.category)} style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 16px", borderRadius:12, marginBottom:6, background: selected === cat.category ? "rgba(255,221,117,0.12)" : "rgba(255,255,255,0.03)", border: selected === cat.category ? "1px solid rgba(255,221,117,0.35)" : "1px solid rgba(255,255,255,0.07)", cursor:"pointer" }}>
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

        {/* ── Clue list ── */}
        {!showCatList && selected && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.15)", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:900, fontSize:17, color:"#ffdd75" }}>{selected}</div>
                  <div style={{ fontSize:12, color:"rgba(246,247,255,0.4)", marginTop:2 }}>{selectedCat?.clues.length ?? 0} clues</div>
                </div>
                {savedFlash && <div style={{ fontSize:13, fontWeight:700, color:"#21c55d" }}>Saved ✓</div>}
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
      </div>

      {/* Confirm delete modal */}
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
    </div>
  );
}