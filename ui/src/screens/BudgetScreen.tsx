import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import type { BudgetCategory, CategoryType, CreateCategoryInput, UpdateCategoryInput } from '../api/types.ts';
import {
  updateCategory as apiUpdateCategory,
  createCategory as apiCreateCategory,
  hideCategory as apiHideCategory,
  deleteCategory as apiDeleteCategory,
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

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function BudgetScreen() {
  const { budget, accounts, selectedMonth, selectMonth, loading, error, refresh, refreshBudget, refreshCategories } = useApp();

  const [editingAssignedId, setEditingAssignedId] = useState<string | null>(null);
  const [editingAssignedValue, setEditingAssignedValue] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [menuCategoryId, setMenuCategoryId] = useState<string | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuCategoryId) return;
    const handler = () => setMenuCategoryId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [menuCategoryId]);

  // Group categories
  const grouped = (budget?.categories ?? []).reduce<Record<string, BudgetCategory[]>>(
    (acc, cat) => {
      const key = cat.group || 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(cat);
      return acc;
    },
    {},
  );

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
    const parsed = Math.round(parseFloat(editingAssignedValue) * 100);
    if (isNaN(parsed)) {
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

  const handleDeleteCategory = useCallback(async (id: string) => {
    try {
      await apiDeleteCategory(id);
      await refresh();
    } catch { /* ignore */ }
  }, [refresh]);

  const handleSaveCategory = useCallback(async (data: CreateCategoryInput | UpdateCategoryInput, id?: string) => {
    try {
      if (id) {
        await apiUpdateCategory(id, data as UpdateCategoryInput);
      } else {
        await apiCreateCategory(data as CreateCategoryInput);
      }
      await Promise.all([refreshBudget(), refreshCategories()]);
    } catch { /* ignore */ }
  }, [refreshBudget, refreshCategories]);

  // --- Compute total income for "ready to assign" ---
  // Income for the month is total income transactions minus what's been assigned
  const totalIncome = accounts.reduce((sum, a) => sum + a.workingBalance, 0);
  const totalAssigned = budget?.totals.assigned ?? 0;
  const readyToAssign = totalIncome - totalAssigned;

  return (
    <div className="max-w-4xl">
      {/* Budget summary bar */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 px-4 py-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Month navigation */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => selectMonth(offsetMonth(selectedMonth, -1))}
                className="text-sm text-slate-400 hover:text-slate-200 px-1"
              >
                &larr;
              </button>
              <span className="text-sm font-semibold text-slate-100 min-w-[150px] text-center">
                {formatMonth(selectedMonth)}
              </span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => selectMonth(offsetMonth(selectedMonth, 1))}
                className="text-sm text-slate-400 hover:text-slate-200 px-1"
              >
                &rarr;
              </button>
            </div>

            {/* Summary stats */}
            {budget && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 uppercase font-semibold tracking-wide">Assigned</span>
                  <span className="tabular-nums font-medium text-slate-200">
                    {formatAmount(budget.totals.assigned)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 uppercase font-semibold tracking-wide">Spent</span>
                  <span className="tabular-nums font-medium text-slate-300">
                    {formatAmount(budget.totals.spent)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 uppercase font-semibold tracking-wide">Available</span>
                  <span className={`tabular-nums font-medium ${budget.totals.available >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatAmount(budget.totals.available)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Ready to assign */}
          {budget && (
            <div className={`text-right px-3 py-1 rounded ${readyToAssign >= 0 ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
              <div className="text-[10px] text-slate-500 uppercase font-semibold tracking-wide">Ready to Assign</div>
              <div className={`text-sm tabular-nums font-bold ${readyToAssign >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatAmount(readyToAssign)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Budget table */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-100">Budget Categories</h2>
          <button
            onClick={() => { setEditingCategory(null); setShowAddCategory(true); }}
            className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 border border-slate-700"
          >
            + Add Category
          </button>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading...</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !budget?.categories.length && (
          <p className="text-sm text-slate-500">No budget categories configured yet. Add a category to get started.</p>
        )}

        {budget && budget.categories.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-700">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right pr-2">Assigned</th>
                <th className="pb-2 font-medium text-right">Spent</th>
                <th className="pb-2 font-medium text-right">Available</th>
                <th className="pb-2 font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([group, cats]) => (
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
              <tr className="border-t-2 border-slate-600 font-medium text-slate-100">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right tabular-nums pr-2">
                  {formatAmount(budget.totals.assigned)}
                </td>
                <td className="pt-2 text-right tabular-nums">
                  {formatAmount(budget.totals.spent)}
                </td>
                <td
                  className={`pt-2 text-right tabular-nums ${
                    budget.totals.available >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {formatAmount(budget.totals.available)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Add/Edit category modal */}
      {showAddCategory && (
        <CategoryFormModal
          category={editingCategory}
          existingGroups={Object.keys(grouped)}
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
      <tr className="bg-slate-800/50">
        <td className="py-1.5 px-1 font-medium text-slate-300" colSpan={1}>
          {group}
        </td>
        <td className="py-1.5 text-right tabular-nums text-slate-500 text-xs pr-2">
          {formatAmount(groupAssigned)}
        </td>
        <td className="py-1.5 text-right tabular-nums text-slate-500 text-xs">
          {formatAmount(groupSpent)}
        </td>
        <td className="py-1.5 text-right tabular-nums text-slate-500 text-xs">
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
    <tr className="border-b border-slate-800 hover:bg-slate-800/30 group/cat">
      <td className="py-1.5 pl-4 text-slate-200">{cat.name}</td>

      {/* Assigned - editable */}
      <td className="py-1.5 text-right tabular-nums text-slate-300 pr-2">
        {isEditingAssigned ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={editingAssignedValue}
            onChange={(e) => onEditAssignedChange(e.target.value)}
            onBlur={onSaveAssigned}
            onKeyDown={handleKeyDown}
            className="bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-slate-200 text-sm w-24 text-right focus:outline-none focus:border-blue-500"
          />
        ) : (
          <button
            type="button"
            className="cursor-pointer hover:text-blue-300 bg-transparent border-none p-0 text-right text-inherit font-inherit tabular-nums"
            onClick={() => onStartEditAssigned(cat)}
            aria-label={`Edit assigned amount for ${cat.name}: ${formatAmount(cat.assigned)}`}
          >
            {formatAmount(cat.assigned)}
          </button>
        )}
      </td>

      <td className="py-1.5 text-right tabular-nums text-slate-300">{formatAmount(cat.spent)}</td>
      <td
        className={`py-1.5 text-right tabular-nums font-medium ${
          cat.available >= 0 ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {formatAmount(cat.available)}
      </td>

      {/* Context menu */}
      <td className="py-1.5 px-1 text-center relative">
        <button
          onClick={(e) => { e.stopPropagation(); onMenuToggle(menuCategoryId === cat.id ? null : cat.id); }}
          className="text-slate-700 hover:text-slate-300 opacity-0 group-hover/cat:opacity-100 transition-opacity text-xs px-1"
          title="Category options"
        >
          &#8943;
        </button>
        {menuCategoryId === cat.id && (
          <div className="absolute right-0 top-full z-30 bg-slate-800 border border-slate-700 rounded shadow-lg py-1 min-w-[120px]">
            <button
              onClick={(e) => { e.stopPropagation(); onEditCategory(cat); }}
              className="w-full text-left text-xs px-3 py-1.5 text-slate-300 hover:bg-slate-700"
            >
              Edit
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onHideCategory(cat.id); }}
              className="w-full text-left text-xs px-3 py-1.5 text-slate-300 hover:bg-slate-700"
            >
              Hide
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); }}
              className="w-full text-left text-xs px-3 py-1.5 text-red-400 hover:bg-slate-700"
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
  const [type, setType] = useState<CategoryType>(category?.type ?? 'expense');
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

    const parsedAssigned = assigned ? Math.round(parseFloat(assigned) * 100) : 0;
    if (assigned && isNaN(parsedAssigned)) { setFormError('Invalid assigned amount.'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        await onSave({
          name: name.trim(),
          type,
          group: finalGroup,
          assigned: parsedAssigned,
        } as UpdateCategoryInput);
      } else {
        await onSave({
          name: name.trim(),
          type,
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
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-100">{isEdit ? 'Edit Category' : 'Add Category'}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close modal">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Name */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <div className="flex gap-1">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded ${
                    type === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Group */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Group</label>
            {!useCustomGroup && existingGroups.length > 0 ? (
              <div className="flex gap-2">
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select group...</option>
                  {existingGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setUseCustomGroup(true)}
                  className="text-xs text-slate-400 hover:text-slate-200 px-2"
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
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
                {existingGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setUseCustomGroup(false)}
                    className="text-xs text-slate-400 hover:text-slate-200 px-2"
                  >
                    Existing
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Assigned amount */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Monthly Budget</label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {formError && <p className="text-xs text-red-400">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
