"use client";

type Props = {
  pendingDeleteId: string | null;
  characterName?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmDialog({ pendingDeleteId, characterName, onCancel, onConfirm }: Props) {
  if (!pendingDeleteId) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="border rounded-xl p-5 max-w-sm w-full shadow-2xl bg-surface border-default">
        <h3 className="text-sm font-semibold mb-2">Delete character?</h3>
        <p className="text-xs mb-4 text-dim">This will remove {characterName || pendingDeleteId} and all saved chants.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg text-xs h-8 px-4 bg-surface bg-surface-hover text-dim">Cancel</button>
          <button onClick={onConfirm} className="bg-red-600 text-white rounded-lg text-xs h-8 px-4 hover:bg-red-500 font-semibold">Delete</button>
        </div>
      </div>
    </div>
  );
}
