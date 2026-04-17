import { useState, useEffect, useCallback } from "react";
import { socket } from "../socket";
import "./jaypardyTheme.css";

export default function EditorScreen() {
  const [categories,    setCategories]    = useState([]);
  const [selected,      setSelected]      = useState(null); // category name
  const [search,        setSearch]        = useState("");
  const [editingClue,   setEditingClue]   = useState(null); // { index, q, a } or "new"
  const [newCatName,    setNewCatName]    = useState("");
  const [showNewCat,    setShowNewCat]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // category name
  const [saved,         setSaved]         = useState(false);

  // Load all categories on mount
  useEffect(() => {
    socket.emit("editor:getAll");
    socket.on("editor:data", (data) => {
      setCategories(data);
    });
    return () => socket.off("editor:data");
  }, []);

  const selectedCat = categories.find((c) => c.category === selected);

  const filteredCats = categories.filter((c) =>
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  // Save the full updated clue list for the selected category
  const saveClues = useCallback((newClues) => {
    if (!selected) return;
    socket.emit("editor:saveCategory", { name: selected, clues: newClues });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [selected]);

  const handleSaveClue = () => {
    if (!editingClue || !selectedCat) return;
    const { q, a } = editingClue;
    if (!q?.trim() || !a?.trim()) return;

    let newClues;
    if (editingClue.index === "new") {
      newClues = [...selectedCat.clues, { q: q.trim(), a: a.trim() }];
    } else {
      newClues = selectedCat.clues.map((cl, i) =>
        i === editingClue.index ? { q: q.trim(), a: a.trim() } : cl
      );
    }
    saveClues(newClues);
    setEditingClue(null);
  };

  const handleDeleteClue = (index) => {
    if (!selectedCat) return;
    const newClues = selectedCat.clues.filter((_, i) => i !== index);
    saveClues(newClues);
  };

  const handleCreateCategory = () => {
    if (!newCatName.trim()) return;
    socket.emit("editor:saveCategory", { name: newCatName.trim(), clues: [] });
    setSelected(newCatName.trim());
    setNewCatName("");
    setShowNewCat(false);
  };

  const handleDeleteCategory = (name) => {
    socket.emit("editor:deleteCategory", { name });
    if (selected === name) setSelected(null);
    setConfirmDelete(null);
  };

  return (
    <div style={{
      minHeight:   "100vh",
      background:  "#050a2a",
      color:       "#f6f7ff",
      fontFamily:  "ui-sans-serif, system-ui, sans-serif",
      display:     "grid",
      gridTemplateRows: "auto 1fr",
    }}>

      {/* Top bar */}
      <header style={{
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        padding:      "10px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background:   "rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontWeight:900, color:"#ffdd75", fontSize:16, letterSpacing:1, marginRight:"auto" }}>
          JAYPARDY — CLUE EDITOR
        </div>
        <div style={{ fontSize:12, color:"rgba(246,247,255,0.4)" }}>
          {categories.length} categories · {categories.reduce((s, c) => s + c.clues.length, 0)} clues
        </div>
        <a href="/" style={{
          padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:700,
          border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.06)",
          color:"#f6f7ff", textDecoration:"none",
        }}>
          ← Back
        </a>
      </header>

      {/* Main layout */}
      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", overflow:"hidden" }}>

        {/* ── Left panel — category list ── */}
        <div style={{
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display:     "flex",
          flexDirection: "column",
          overflow:    "hidden",
        }}>
          <div style={{ padding:"12px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              style={{
                width:"100%", padding:"8px 12px", fontSize:13, borderRadius:8,
                border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)",
                color:"#f6f7ff", outline:"none", boxSizing:"border-box",
              }}
            />
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
            {filteredCats.map((cat) => (
              <div
                key={cat.category}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          8,
                  padding:      "8px 10px",
                  borderRadius: 8,
                  marginBottom: 3,
                  cursor:       "pointer",
                  background:   selected === cat.category
                    ? "rgba(255,221,117,0.15)"
                    : "transparent",
                  border: selected === cat.category
                    ? "1px solid rgba(255,221,117,0.35)"
                    : "1px solid transparent",
                }}
                onClick={() => { setSelected(cat.category); setEditingClue(null); }}
              >
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, color: selected === cat.category ? "#ffdd75" : "#f6f7ff" }}>
                    {cat.category}
                  </div>
                  <div style={{ fontSize:11, color:"rgba(246,247,255,0.4)", marginTop:1 }}>
                    {cat.clues.length} clue{cat.clues.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(cat.category); }}
                  style={{
                    background:"transparent", border:"none", color:"rgba(239,68,68,0.5)",
                    cursor:"pointer", fontSize:14, padding:"2px 4px", borderRadius:4,
                    flexShrink:0,
                  }}
                  title="Delete category"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding:"10px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            {showNewCat ? (
              <div style={{ display:"flex", gap:6 }}>
                <input
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
                  placeholder="Category name…"
                  maxLength={60}
                  style={{
                    flex:1, padding:"7px 10px", fontSize:12, borderRadius:7,
                    border:"1px solid rgba(255,255,255,0.2)", background:"rgba(255,255,255,0.08)",
                    color:"#f6f7ff", outline:"none",
                  }}
                />
                <button
                  onClick={handleCreateCategory}
                  disabled={!newCatName.trim()}
                  style={{
                    padding:"7px 12px", borderRadius:7, fontSize:12, fontWeight:900,
                    border:"1px solid rgba(255,221,117,0.4)", background:"rgba(255,221,117,0.15)",
                    color:"#ffdd75", cursor: newCatName.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowNewCat(false); setNewCatName(""); }}
                  style={{
                    padding:"7px 10px", borderRadius:7, fontSize:12,
                    border:"1px solid rgba(255,255,255,0.12)", background:"transparent",
                    color:"rgba(246,247,255,0.5)", cursor:"pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewCat(true)}
                style={{
                  width:"100%", padding:"8px", borderRadius:8, fontSize:12, fontWeight:700,
                  border:"1px solid rgba(255,221,117,0.3)", background:"rgba(255,221,117,0.08)",
                  color:"#ffdd75", cursor:"pointer",
                }}
              >
                + New Category
              </button>
            )}
          </div>
        </div>

        {/* ── Right panel — clue list ── */}
        <div style={{ display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {!selected ? (
            <div style={{
              flex:1, display:"flex", alignItems:"center", justifyContent:"center",
              color:"rgba(246,247,255,0.25)", fontSize:15, flexDirection:"column", gap:8,
            }}>
              <div style={{ fontSize:32 }}>✏️</div>
              <div>Select a category to edit its clues</div>
            </div>
          ) : (
            <>
              {/* Category header */}
              <div style={{
                padding:      "14px 20px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display:      "flex",
                alignItems:   "center",
                gap:          12,
                background:   "rgba(0,0,0,0.15)",
                flexShrink:   0,
              }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:900, fontSize:18, color:"#ffdd75" }}>{selected}</div>
                  <div style={{ fontSize:12, color:"rgba(246,247,255,0.4)", marginTop:2 }}>
                    {selectedCat?.clues.length ?? 0} clues — need at least 10 for full variety
                  </div>
                </div>
                {saved && (
                  <div style={{ fontSize:12, fontWeight:700, color:"#21c55d" }}>Saved ✓</div>
                )}
                <button
                  onClick={() => setEditingClue({ index:"new", q:"", a:"" })}
                  style={{
                    padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:700,
                    border:"1px solid rgba(33,197,93,0.4)", background:"rgba(33,197,93,0.12)",
                    color:"#21c55d", cursor:"pointer",
                  }}
                >
                  + Add Clue
                </button>
              </div>

              {/* Clue list */}
              <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>

                {/* Inline new clue form */}
                {editingClue?.index === "new" && (
                  <div style={{
                    padding:"14px", borderRadius:12, marginBottom:10,
                    background:"rgba(33,197,93,0.08)", border:"1px solid rgba(33,197,93,0.3)",
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"rgba(246,247,255,0.5)", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>
                      New Clue
                    </div>
                    <textarea
                      autoFocus
                      value={editingClue.q}
                      onChange={(e) => setEditingClue((prev) => ({ ...prev, q: e.target.value }))}
                      placeholder="Clue — written as a statement or description"
                      rows={2}
                      style={{
                        width:"100%", padding:"8px 10px", fontSize:13, borderRadius:8,
                        border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)",
                        color:"#f6f7ff", outline:"none", resize:"vertical", boxSizing:"border-box",
                        marginBottom:6, fontFamily:"inherit",
                      }}
                    />
                    <input
                      value={editingClue.a}
                      onChange={(e) => setEditingClue((prev) => ({ ...prev, a: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveClue()}
                      placeholder="Answer — e.g. What is the Super Bowl?"
                      style={{
                        width:"100%", padding:"8px 10px", fontSize:13, borderRadius:8,
                        border:"1px solid rgba(255,221,117,0.2)", background:"rgba(255,221,117,0.06)",
                        color:"#ffdd75", outline:"none", boxSizing:"border-box", marginBottom:10,
                      }}
                    />
                    <div style={{ display:"flex", gap:8 }}>
                      <button
                        onClick={handleSaveClue}
                        disabled={!editingClue.q.trim() || !editingClue.a.trim()}
                        style={{
                          padding:"7px 16px", borderRadius:7, fontSize:12, fontWeight:700,
                          border:"none", background: editingClue.q.trim() && editingClue.a.trim() ? "#21c55d" : "rgba(255,255,255,0.08)",
                          color: editingClue.q.trim() && editingClue.a.trim() ? "#fff" : "rgba(255,255,255,0.3)",
                          cursor: editingClue.q.trim() && editingClue.a.trim() ? "pointer" : "not-allowed",
                        }}
                      >
                        Save Clue
                      </button>
                      <button
                        onClick={() => setEditingClue(null)}
                        style={{
                          padding:"7px 12px", borderRadius:7, fontSize:12,
                          border:"1px solid rgba(255,255,255,0.12)", background:"transparent",
                          color:"rgba(246,247,255,0.5)", cursor:"pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing clues */}
                {selectedCat?.clues.length === 0 && editingClue?.index !== "new" ? (
                  <div style={{ textAlign:"center", color:"rgba(246,247,255,0.3)", fontSize:14, padding:"40px 0" }}>
                    No clues yet — click + Add Clue to get started.
                  </div>
                ) : (
                  selectedCat?.clues.map((cl, i) => (
                    <div key={i} style={{
                      padding:"12px 14px", borderRadius:10, marginBottom:8,
                      background: editingClue?.index === i
                        ? "rgba(255,221,117,0.08)"
                        : "rgba(255,255,255,0.04)",
                      border: editingClue?.index === i
                        ? "1px solid rgba(255,221,117,0.3)"
                        : "1px solid rgba(255,255,255,0.07)",
                    }}>
                      {editingClue?.index === i ? (
                        // Inline edit form
                        <>
                          <textarea
                            autoFocus
                            value={editingClue.q}
                            onChange={(e) => setEditingClue((prev) => ({ ...prev, q: e.target.value }))}
                            rows={2}
                            style={{
                              width:"100%", padding:"8px 10px", fontSize:13, borderRadius:8,
                              border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.07)",
                              color:"#f6f7ff", outline:"none", resize:"vertical", boxSizing:"border-box",
                              marginBottom:6, fontFamily:"inherit",
                            }}
                          />
                          <input
                            value={editingClue.a}
                            onChange={(e) => setEditingClue((prev) => ({ ...prev, a: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleSaveClue()}
                            style={{
                              width:"100%", padding:"8px 10px", fontSize:13, borderRadius:8,
                              border:"1px solid rgba(255,221,117,0.2)", background:"rgba(255,221,117,0.06)",
                              color:"#ffdd75", outline:"none", boxSizing:"border-box", marginBottom:10,
                            }}
                          />
                          <div style={{ display:"flex", gap:8 }}>
                            <button
                              onClick={handleSaveClue}
                              disabled={!editingClue.q.trim() || !editingClue.a.trim()}
                              style={{
                                padding:"6px 14px", borderRadius:7, fontSize:12, fontWeight:700,
                                border:"none",
                                background: editingClue.q.trim() && editingClue.a.trim() ? "#ffdd75" : "rgba(255,255,255,0.08)",
                                color: editingClue.q.trim() && editingClue.a.trim() ? "#000" : "rgba(255,255,255,0.3)",
                                cursor: editingClue.q.trim() && editingClue.a.trim() ? "pointer" : "not-allowed",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingClue(null)}
                              style={{
                                padding:"6px 12px", borderRadius:7, fontSize:12,
                                border:"1px solid rgba(255,255,255,0.12)", background:"transparent",
                                color:"rgba(246,247,255,0.5)", cursor:"pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        // Read view
                        <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                          <div style={{ fontSize:11, fontWeight:900, color:"rgba(246,247,255,0.25)", minWidth:24, paddingTop:2 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, color:"#f6f7ff", lineHeight:1.4, marginBottom:4 }}>
                              {cl.q}
                            </div>
                            <div style={{ fontSize:12, color:"#ffdd75", fontStyle:"italic" }}>
                              {cl.a}
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                            <button
                              onClick={() => setEditingClue({ index:i, q:cl.q, a:cl.a })}
                              style={{
                                padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:700,
                                border:"1px solid rgba(255,255,255,0.15)", background:"rgba(255,255,255,0.06)",
                                color:"rgba(246,247,255,0.7)", cursor:"pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClue(i)}
                              style={{
                                padding:"4px 8px", borderRadius:6, fontSize:11,
                                border:"1px solid rgba(239,68,68,0.25)", background:"rgba(239,68,68,0.08)",
                                color:"#fca5a5", cursor:"pointer",
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm delete category modal */}
      {confirmDelete && (
        <div style={{
          position:"fixed", inset:0, zIndex:999,
          background:"rgba(0,0,0,0.75)", display:"flex",
          alignItems:"center", justifyContent:"center", padding:24,
        }}>
          <div style={{
            background:"#090f3a", border:"1px solid rgba(255,255,255,0.15)",
            borderRadius:20, padding:28, width:"100%", maxWidth:380, textAlign:"center",
          }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#fca5a5", marginBottom:8 }}>
              Delete Category?
            </div>
            <div style={{ fontSize:14, color:"rgba(246,247,255,0.6)", marginBottom:20 }}>
              <strong style={{ color:"#fff" }}>"{confirmDelete}"</strong> and all its clues will be permanently deleted.
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <button
                className="jp-btn"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="jp-btn"
                style={{ background:"rgba(239,68,68,0.18)", borderColor:"rgba(239,68,68,0.45)", color:"#fca5a5", fontWeight:900 }}
                onClick={() => handleDeleteCategory(confirmDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}