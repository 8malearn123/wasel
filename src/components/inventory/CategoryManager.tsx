import { useState } from "react";
import { Plus, Trash2, Edit, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, MerchantCategory } from "@/hooks/useCategories";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

export function CategoryManager() {
  const { categories, loading, addCategory, updateCategory, deleteCategory } = useCategories();
  const { isRTL } = useLanguage();
  const [showAdd, setShowAdd] = useState(false);
  const [editingCat, setEditingCat] = useState<MerchantCategory | null>(null);
  const [formData, setFormData] = useState({ name: '', name_ar: '', type: 'all' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);

    if (editingCat) {
      await updateCategory(editingCat.id, {
        name: formData.name,
        name_ar: formData.name_ar || null,
        type: formData.type as any,
      });
    } else {
      await addCategory({
        name: formData.name,
        name_ar: formData.name_ar || undefined,
        type: formData.type,
      });
    }

    setSaving(false);
    setShowAdd(false);
    setEditingCat(null);
    setFormData({ name: '', name_ar: '', type: 'all' });
  };

  const openEdit = (cat: MerchantCategory) => {
    setEditingCat(cat);
    setFormData({ name: cat.name, name_ar: cat.name_ar || '', type: cat.type });
    setShowAdd(true);
  };

  const typeLabels: Record<string, string> = {
    all: isRTL ? 'الكل' : 'All',
    device: isRTL ? 'أجهزة' : 'Devices',
    accessory: isRTL ? 'إكسسوارات' : 'Accessories',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {isRTL ? 'التصنيفات' : 'Categories'}
          </h3>
          <span className="text-sm text-muted-foreground">({categories.length})</span>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditingCat(null);
            setFormData({ name: '', name_ar: '', type: 'all' });
            setShowAdd(true);
          }}
        >
          <Plus className="w-4 h-4" />
          {isRTL ? 'إضافة تصنيف' : 'Add Category'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {isRTL ? 'لا توجد تصنيفات بعد. أضف تصنيفاً لتنظيم منتجاتك.' : 'No categories yet. Add a category to organize your products.'}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(cat => (
            <div
              key={cat.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{cat.name}</p>
                {cat.name_ar && <p className="text-xs text-muted-foreground truncate">{cat.name_ar}</p>}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  {typeLabels[cat.type]}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteCategory(cat.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) { setShowAdd(false); setEditingCat(null); } }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingCat
                ? (isRTL ? 'تعديل التصنيف' : 'Edit Category')
                : (isRTL ? 'إضافة تصنيف' : 'Add Category')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'} *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Cases & Covers"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}</Label>
              <Input
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                placeholder="مثل: أغطية وحمايات"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label>{isRTL ? 'النوع' : 'Type'}</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRTL ? 'الكل (أجهزة + إكسسوارات)' : 'All (Devices + Accessories)'}</SelectItem>
                  <SelectItem value="device">{isRTL ? 'أجهزة فقط' : 'Devices Only'}</SelectItem>
                  <SelectItem value="accessory">{isRTL ? 'إكسسوارات فقط' : 'Accessories Only'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditingCat(null); }}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleSave} disabled={saving || !formData.name.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCat ? (isRTL ? 'حفظ' : 'Save') : (isRTL ? 'إضافة' : 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
