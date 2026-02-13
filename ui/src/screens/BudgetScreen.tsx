import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import type { BudgetCategory, CreateCategoryInput, UpdateCategoryInput } from '../api/types.ts';
import {
  updateCategory as apiUpdateCategory,
  createCategory as apiCreateCategory,
  hideCategory as apiHideCategory,
  deleteCategory as apiDeleteCategory,
  unhideCategory as apiUnhideCategory,
} from '../api/categories.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAmount(amount: number): string {
  const value = amount / 100;
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function offsetMonth(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  const ny = d.getFullYear();
  const nm = String(d.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Parse a money string to integer cents, returning null if invalid or out of range */
function parseMoneyInput(value: string): number | null {
  const parsed = Math.round(parseFloat(value) * 100);
  if (!Number.isFinite(parsed)) return null;
  // Clamp to a sane range: +/- $100 million
  if (Math.abs(parsed) > 10_000_000_00) return null;
  return parsed;
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function BudgetScreen() {
  const { budget, categories, selectedMonth, selectMonth, loading, error, refresh, refreshBudget, refreshCategories } = useApp();

  const [editingAssignedId, setEditingAssignedId] = useState<string | null>(null);
  const [editingAssignedValue, setEditingAssignedValue] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [menuCategoryId, setMenuCategoryId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuCategoryId) return;
    const handler = () => setMenuCategoryId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuCategoryId]);

  // Group categories using Map to avoid prototype pollution
  const grouped = (budget?.categories ?? []).reduce<Map<string, BudgetCategory[]>>(
    (acc, cat) => {
      const key = cat.group || 'Uncategorized';
      let list = acc.get(key);
      if (!list) {
        list = [];
        acc.set(key, list);
      }
      list.push(cat);
      return acc;
    },
    new Map(),
  );

  // Hidden categories from the full categories list
  const hiddenCategories = categories.filter((c) => c.hidden);

  // Collect existing group names for the category form
  const existingGroups = Array.from(grouped.keys());

  // --- Inline assigned editing ---
  const startEditAssigned = useCallback((cat: BudgetCategory) => {
    setEditingAssignedId(cat.id);
    setEditingAssignedValue(String(cat.assigned / 100));
  }, []);

  const cancelEditAssigned = useCallback(() => {
    setEditingAssignedId(null);
    setEditingAssignedValue('');
  }, []);

  const saveAssigned = useCallback(async () => {
    if (!editingAssignedId) return;
    const parsed = parseMoneyInput(editingAssignedValue);
    if (parsed === null) {
      cancelEditAssigned();
      return;
    }
    try {
      await apiUpdateCategory(editingAssignedId, { assigned: parsed });
      cancelEditAssigned();
      await Promise.all([refreshBudget(), refreshCategories()]);
    } catch {
      cancelEditAssigned();
    }
  }, [editingAssignedId, editingAssignedValue, cancelEditAssigned, refreshBudget, refreshCategories]);

  // --- Category actions ---
  const handleHideCategory = useCallback(async (id: string) => {
    try {
      await apiHideCategory(id);
      await Promise.all([refreshBudget(), refreshCategories()]);
    } catch { /* ignore */ }
  }, [refreshBudget, refreshCategories]);

  const handleUnhideCategory = useCallback(async (id: string) => {
    try {
      await apiUnhideCategory(id);
      await Promise.all([refreshBudget(), refreshCategories()]);
    } catch { /* ignore */ }
  }, [refreshBudget, refreshCategories]);

  const handleDeleteCategory = useCallback(async (id: string) => {
    try {
      await apiDeleteCategory(id);
      await refresh();
    } catch { /* ignore */ }
  }, [refresh]);

  // Let errors propagate so the modal can display them
  const handleSaveCategory = useCallback(async (data: CreateCategoryInput | UpdateCategoryInput, id?: string) => {
    if (id) {
      await apiUpdateCategory(id, data as UpdateCategoryInput);
    } else {
      await apiCreateCategory(data as CreateCategoryInput);
    }
    await Promise.all([refreshBudget(), refreshCategories()]);
  }, [refreshBudget, refreshCategories]);

  // --- Ready to assign: income for the month minus total assigned ---
  const monthlyIncome = budget?.income ?? 0;
  const totalAssigned = budget?.totals.assigned ?? 0;
  const readyToAssign = monthlyIncome - totalAssigned;

  return (
    <div className="max-w-4xl">
      {/* Budget summary bar */}
      <div className="bg-surface rounded-lg border border-edge px-4 py-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Month navigation */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => selectMonth(offsetMonth(selectedMonth, -1))}
                className="text-sm text-muted hover:text-body px-1"
              >
                &larr;
              </button>
              <span className="text-sm font-semibold text-heading min-w-[150px] text-center">
                {formatMonth(selectedMonth)}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => selectMonth(offsetMonth(selectedMonth, 1))}
                className="text-sm text-muted hover:text-body px-1"
              >
                &rarr;
              </button>
            </div>

            {/* Summary stats */}
            {budget && (
              <div className="flex items-center gap-5 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted uppercase font-semibold tracking-wider">Income</span>
                  <span className="tabular-nums font-semibold text-positive">
                    {formatAmount(monthlyIncome)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted uppercase font-semibold tracking-wider">Assigned</span>
                  <span className="tabular-nums font-semibold text-body">
                    {formatAmount(budget.totals.assigned)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted uppercase font-semibold tracking-wider">Spent</span>
                  <span className="tabular-nums font-semibold text-label">
                    {formatAmount(budget.totals.spent)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted uppercase font-semibold tracking-wider">Available</span>
                  <span className={`tabular-nums font-semibold ${budget.totals.available >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {formatAmount(budget.totals.available)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Ready to assign */}
          {budget && (
            <div className={`text-right px-3 py-1 rounded ${readyToAssign >= 0 ? 'bg-positive-surface' : 'bg-negative-surface'}`}>
              <div className="text-[10px] text-dim uppercase font-semibold tracking-wide">Ready to Assign</div>
              <div className={`text-sm tabular-nums font-bold ${readyToAssign >= 0 ? 'text-positive' : 'text-negative'}`}>
                {formatAmount(readyToAssign)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Budget table */}
      <div className="bg-surface rounded-lg border border-edge p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-heading">Budget Categories</h2>
          <div className="flex items-center gap-2">
            {hiddenCategories.length > 0 && (
              <button
                onClick={() => setShowHidden((v) => !v)}
                className={`text-xs font-medium px-2 py-0.5 rounded border ${
                  showHidden
                    ? 'bg-hover text-body border-edge-accent'
                    : 'bg-elevated text-dim hover:text-label border-edge-strong'
                }`}
              >
                {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCategories.length})`}
              </button>
            )}
            <button
              onClick={() => { setEditingCategory(null); setShowAddCategory(true); }}
              className="text-xs font-medium px-2 py-0.5 rounded bg-elevated text-muted hover:text-body hover:bg-hover border border-edge-strong"
            >
              + Add Category
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-dim">Loading...</p>}
        {error && <p className="text-sm text-negative">{error}</p>}

        {!loading && !budget?.categories.length && (
          <p className="text-sm text-dim">No budget categories configured yet. Add a category to get started.</p>
        )}

        {budget && budget.categories.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-muted uppercase tracking-wider border-b border-edge-strong">
                <th className="py-3 px-1 font-semibold">Category</th>
                <th className="py-3 font-semibold text-right pr-2">Assigned</th>
                <th className="py-3 font-semibold text-right">Spent</th>
                <th className="py-3 font-semibold text-right">Available</th>
                <th className="py-3 font-semibold w-8"></th>
              </tr>
            </thead>
            <tbody>
              {Array.from(grouped.entries()).map(([group, cats]) => (
                <GroupRows
                  key={group}
                  group={group}
                  categories={cats}
                  editingAssignedId={editingAssignedId}
                  editingAssignedValue={editingAssignedValue}
                  onStartEditAssigned={startEditAssigned}
                  onEditAssignedChange={setEditingAssignedValue}
                  onSaveAssigned={saveAssigned}
                  onCancelEditAssigned={cancelEditAssigned}
                  menuCategoryId={menuCategoryId}
                  onMenuToggle={setMenuCategoryId}
                  onEditCategory={(cat) => { setMenuCategoryId(null); setEditingCategory(cat); setShowAddCategory(true); }}
                  onHideCategory={(id) => { setMenuCategoryId(null); handleHideCategory(id); }}
                  onDeleteCategory={(id) => { setMenuCategoryId(null); handleDeleteCategory(id); }}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-edge-accent font-semibold text-heading">
                <td className="pt-3 pb-1 px-1">Total</td>
                <td className="pt-3 pb-1 text-right tabular-nums pr-2">
                  {formatAmount(budget.totals.assigned)}
                </td>
                <td className="pt-3 pb-1 text-right tabular-nums">
                  {formatAmount(budget.totals.spent)}
                </td>
                <td
                  className={`pt-3 pb-1 text-right tabular-nums ${
                    budget.totals.available >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {formatAmount(budget.totals.available)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}

        {/* Hidden categories section */}
        {showHidden && hiddenCategories.length > 0 && (
          <div className="mt-4 border-t border-edge-strong pt-3">
            <h3 className="text-xs font-semibold text-dim uppercase tracking-wide mb-2">Hidden Categories</h3>
            <div className="space-y-1">
              {hiddenCategories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-elevated/30">
                  <div>
                    <span className="text-sm text-muted">{cat.name}</span>
                    <span className="text-xs text-faint ml-2">{cat.group}</span>
                  </div>
                  <button
                    onClick={() => handleUnhideCategory(cat.id)}
                    className="text-xs font-medium px-2 py-0.5 rounded bg-elevated text-muted hover:text-body hover:bg-hover border border-edge-strong"
                  >
                    Unhide
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit category modal */}
      {showAddCategory && (
        <CategoryFormModal
          category={editingCategory}
          existingGroups={existingGroups}
          onClose={() => { setShowAddCategory(false); setEditingCategory(null); }}
          onSave={async (data) => {
            await handleSaveCategory(data, editingCategory?.id);
            setShowAddCategory(false);
            setEditingCategory(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group Rows
// ---------------------------------------------------------------------------

function GroupRows({
  group,
  categories,
  editingAssignedId,
  editingAssignedValue,
  onStartEditAssigned,
  onEditAssignedChange,
  onSaveAssigned,
  onCancelEditAssigned,
  menuCategoryId,
  onMenuToggle,
  onEditCategory,
  onHideCategory,
  onDeleteCategory,
}: {
  group: string;
  categories: BudgetCategory[];
  editingAssignedId: string | null;
  editingAssignedValue: string;
  onStartEditAssigned: (cat: BudgetCategory) => void;
  onEditAssignedChange: (v: string) => void;
  onSaveAssigned: () => void;
  onCancelEditAssigned: () => void;
  menuCategoryId: string | null;
  onMenuToggle: (id: string | null) => void;
  onEditCategory: (cat: BudgetCategory) => void;
  onHideCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
}) {
  const groupAssigned = categories.reduce((s, c) => s + c.assigned, 0);
  const groupSpent = categories.reduce((s, c) => s + c.spent, 0);
  const groupAvailable = categories.reduce((s, c) => s + c.available, 0);

  return (
    <>
      <tr className="bg-elevated/40">
        <td className="py-2.5 px-1 font-semibold text-body text-[13px]" colSpan={1}>
          {group}
        </td>
        <td className="py-2.5 text-right tabular-nums text-dim text-xs pr-2">
          {formatAmount(groupAssigned)}
        </td>
        <td className="py-2.5 text-right tabular-nums text-dim text-xs">
          {formatAmount(groupSpent)}
        </td>
        <td className="py-2.5 text-right tabular-nums text-dim text-xs">
          {formatAmount(groupAvailable)}
        </td>
        <td></td>
      </tr>
      {categories.map((cat) => (
        <CategoryRow
          key={cat.id}
          cat={cat}
          editingAssignedId={editingAssignedId}
          editingAssignedValue={editingAssignedValue}
          onStartEditAssigned={onStartEditAssigned}
          onEditAssignedChange={onEditAssignedChange}
          onSaveAssigned={onSaveAssigned}
          onCancelEditAssigned={onCancelEditAssigned}
          menuCategoryId={menuCategoryId}
          onMenuToggle={onMenuToggle}
          onEditCategory={onEditCategory}
          onHideCategory={onHideCategory}
          onDeleteCategory={onDeleteCategory}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Category Row (with inline assigned editing + context menu)
// ---------------------------------------------------------------------------

function CategoryRow({
  cat,
  editingAssignedId,
  editingAssignedValue,
  onStartEditAssigned,
  onEditAssignedChange,
  onSaveAssigned,
  onCancelEditAssigned,
  menuCategoryId,
  onMenuToggle,
  onEditCategory,
  onHideCategory,
  onDeleteCategory,
}: {
  cat: BudgetCategory;
  editingAssignedId: string | null;
  editingAssignedValue: string;
  onStartEditAssigned: (cat: BudgetCategory) => void;
  onEditAssignedChange: (v: string) => void;
  onSaveAssigned: () => void;
  onCancelEditAssigned: () => void;
  menuCategoryId: string | null;
  onMenuToggle: (id: string | null) => void;
  onEditCategory: (cat: BudgetCategory) => void;
  onHideCategory: (id: string) => void;
  onDeleteCategory: (id: string) => void;
}) {
  const isEditingAssigned = editingAssignedId === cat.id;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingAssigned && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingAssigned]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSaveAssigned();
    if (e.key === 'Escape') onCancelEditAssigned();
  };

  return (
    <tr className="border-b border-edge/40 hover:bg-elevated/20 group/cat">
      <td className="py-2.5 pl-5 text-body">{cat.name}</td>

      {/* Assigned - editable */}
      <td className="py-2.5 text-right tabular-nums text-label pr-2">
        {isEditingAssigned ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editingAssignedValue}
            onChange={(e) => onEditAssignedChange(e.target.value)}
            onBlur={onSaveAssigned}
            onKeyDown={handleKeyDown}
            className="bg-elevated border border-edge-accent rounded px-1.5 py-0.5 text-body text-sm w-24 text-right focus:outline-none focus:border-accent"
          />
        ) : (
          <button
            type="button"
            className="cursor-pointer hover:text-accent-text bg-transparent border-none p-0 text-right text-inherit font-inherit tabular-nums"
            onClick={() => onStartEditAssigned(cat)}
            aria-label={`Edit assigned amount for ${cat.name}: ${formatAmount(cat.assigned)}`}
          >
            {formatAmount(cat.assigned)}
          </button>
        )}
      </td>

      <td className="py-2.5 text-right tabular-nums text-label">{formatAmount(cat.spent)}</td>
      <td
        className={`py-2.5 text-right tabular-nums font-medium ${
          cat.available >= 0 ? 'text-positive' : 'text-negative'
        }`}
      >
        {formatAmount(cat.available)}
      </td>

      {/* Context menu */}
      <td className="py-2.5 px-1 text-center relative">
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(menuCategoryId === cat.id ? null : cat.id); }}
          className="text-dim hover:text-label opacity-70 group-hover/cat:opacity-100 transition-opacity text-xs px-1"
          title="Category options"
        >
          &#8943;
        </button>
        {menuCategoryId === cat.id && (
          <div className="absolute right-0 top-full z-30 bg-elevated border border-edge-strong rounded shadow-lg py-1 min-w-[120px]">
            <button
              onClick={(e) => { e.stopPropagation(); onEditCategory(cat); }}
              className="w-full text-left text-xs px-3 py-1.5 text-label hover:bg-hover"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onHideCategory(cat.id); }}
              className="w-full text-left text-xs px-3 py-1.5 text-label hover:bg-hover"
            >
              Hide
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
              className="w-full text-left text-xs px-3 py-1.5 text-negative hover:bg-hover"
            >
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Category Form Modal (Add / Edit)
// ---------------------------------------------------------------------------

function CategoryFormModal({
  category,
  existingGroups,
  onClose,
  onSave,
}: {
  category: BudgetCategory | null;
  existingGroups: string[];
  onClose: () => void;
  onSave: (data: CreateCategoryInput | UpdateCategoryInput) => Promise<void>;
}) {
  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? '');
  const [group, setGroup] = useState(category?.group ?? '');
  const [customGroup, setCustomGroup] = useState('');
  const [useCustomGroup, setUseCustomGroup] = useState(false);
  const [assigned, setAssigned] = useState(category ? String(category.assigned / 100) : '');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!name.trim()) { setFormError('Name is required.'); return; }

    const finalGroup = useCustomGroup ? customGroup.trim() : group;
    if (!finalGroup) { setFormError('Group is required.'); return; }

    let parsedAssigned = 0;
    if (assigned) {
      const result = parseMoneyInput(assigned);
      if (result === null) { setFormError('Invalid assigned amount.'); return; }
      parsedAssigned = result;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await onSave({
          name: name.trim(),
          group: finalGroup,
          assigned: parsedAssigned,
        } as UpdateCategoryInput);
      } else {
        await onSave({
          name: name.trim(),
          group: finalGroup,
          assigned: parsedAssigned,
        } as CreateCategoryInput);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit Category' : 'Add Category'}
    >
      <div
        className="bg-surface border border-edge-strong rounded-lg shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-heading">{isEdit ? 'Edit Category' : 'Add Category'}</h3>
          <button onClick={onClose} className="text-dim hover:text-label" aria-label="Close modal">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs text-dim mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-elevated border border-edge-strong rounded px-2 py-1.5 text-sm text-body focus:outline-none focus:border-accent"
            />
          </div>

          {/* Group */}
          <div>
            <label className="block text-xs text-dim mb-1">Group</label>
            {!useCustomGroup && existingGroups.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="flex-1 bg-elevated border border-edge-strong rounded px-2 py-1.5 text-sm text-body focus:outline-none focus:border-accent"
                >
                  <option value="">Select group...</option>
                  {existingGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setUseCustomGroup(true)}
                  className="text-xs text-muted hover:text-body px-2"
                  title="Create new group"
                >
                  + New
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customGroup}
                  onChange={(e) => setCustomGroup(e.target.value)}
                  placeholder="New group name"
                  className="flex-1 bg-elevated border border-edge-strong rounded px-2 py-1.5 text-sm text-body placeholder-faint focus:outline-none focus:border-accent"
                />
                {existingGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseCustomGroup(false)}
                    className="text-xs text-muted hover:text-body px-2"
                  >
                    Existing
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Assigned amount */}
          <div>
            <label className="block text-xs text-dim mb-1">Monthly Budget</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
              className="w-full bg-elevated border border-edge-strong rounded px-2 py-1.5 text-sm text-body placeholder-faint focus:outline-none focus:border-accent"
            />
          </div>

          {formError && <p className="text-xs text-negative">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded text-muted hover:text-body bg-elevated border border-edge-strong"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
