import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TopBrand } from "@/components/lifeos/TopBrand";
import { BottomNav } from "@/components/lifeos/BottomNav";
import { CoreAIFAB } from "@/components/lifeos/CoreAI/CoreAIFAB";
import { useLifeOSStore } from "@/stores/useLifeOSStore";
import { useCoreAI } from "@/hooks/useCoreAI";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

// Aesthetic planner/calendar color palette
const colorPalette = [
  { name: "Dusty Rose", value: "#EAA4A6" },
  { name: "Muted Sage", value: "#A2C1A8" },
  { name: "Pale Sky", value: "#A5BBC6" },
  { name: "Creamy Yellow", value: "#E8D8BF" },
  { name: "Soft Peach", value: "#D4C2B4" },
  { name: "Lavender Mist", value: "#B6A8C7" },
  { name: "Hint of Mint", value: "#9BC5BB" },
  { name: "Mauve", value: "#BF9CA6" },
  { name: "Goldenrod", value: "#DBC599" },
  { name: "Deep Teal", value: "#A4B5B0" },
  { name: "Taupe Stone", value: "#B7B0A8" },
  { name: "Soft Slate", value: "#A9B3C1" },
];

export default function Categories() {
  const store = useLifeOSStore();
  const coreAI = useCoreAI();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [openColorPicker, setOpenColorPicker] = useState<string | null>(null);

  const handleEditStart = (id: string, label: string) => {
    setEditingId(id);
    setEditValue(label);
  };

  const handleEditSave = async (id: string) => {
    if (editValue.trim()) {
      try {
        await store.updateCategory(id, { label: editValue.trim() });
        toast.success("Category updated");
        setEditingId(null);
        setEditValue("");
      } catch (error: any) {
        console.error("Failed to update category:", error);
        toast.error(error?.message || "Failed to update category");
      }
    } else {
      setEditingId(null);
      setEditValue("");
    }
  };

  const handleColorChange = async (id: string, color: string) => {
    try {
      await store.updateCategory(id, { color });
      setOpenColorPicker(null);
      toast.success("Color updated");
    } catch (error: any) {
      console.error("Failed to update color:", error);
      toast.error(error?.message || "Failed to update color");
      setOpenColorPicker(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await store.deleteCategory(id);
      toast.success("Category deleted");
    } catch (error: any) {
      console.error("Failed to delete category:", error);
      toast.error(error?.message || "Failed to delete category");
    }
  };

  const handleAddCategory = async () => {
    const usedColors = store.categories.map(c => c.color);
    const availableColor = colorPalette.find(c => !usedColors.includes(c.value))?.value || colorPalette[0].value;
    try {
      await store.addCategory("New Category", availableColor);
      toast.success("Category added");
    } catch (error: any) {
      console.error("Failed to add category:", error);
      toast.error(error?.message || "Failed to add category");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopBrand />
      
      <div className="px-4 pt-16 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-serif font-medium text-foreground">Categories</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6 ml-12">
          Customize your task categories
        </p>

        {/* Categories List */}
        <div className="bg-card rounded-2xl border border-border/50 divide-y divide-border/50">
          {store.categories.map((category) => (
            <div key={category.id} className="p-4 flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-muted-foreground/50" />
              
              {/* Color Picker Popover */}
              <Popover 
                open={openColorPicker === category.id} 
                onOpenChange={(open) => setOpenColorPicker(open ? category.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    className="w-8 h-8 rounded-full border-2 border-border/50 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    style={{ backgroundColor: category.color }}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Choose a color</p>
                  <div className="grid grid-cols-4 gap-2">
                    {colorPalette.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => handleColorChange(category.id, color.value)}
                        className={cn(
                          "w-10 h-10 rounded-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring",
                          category.color === color.value && "ring-2 ring-foreground ring-offset-2"
                        )}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Name */}
              <div className="flex-1">
                {editingId === category.id ? (
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleEditSave(category.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEditSave(category.id);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditValue("");
                      }
                    }}
                    autoFocus
                    className="h-8 text-sm"
                  />
                ) : (
                  <button
                    onClick={() => handleEditStart(category.id, category.label)}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors text-left"
                  >
                    {category.label}
                  </button>
                )}
              </div>

              {/* Delete */}
              {store.categories.length > 1 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete category?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove "{category.label}" from your categories. Tasks with this category will remain but may need to be recategorized.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDelete(category.id)} 
                        className="bg-destructive text-destructive-foreground"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>

        {/* Add Category Button */}
        <Button
          onClick={handleAddCategory}
          variant="outline"
          className="w-full mt-4 rounded-xl border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      <BottomNav />
      <CoreAIFAB
        messages={coreAI.messages}
        onSendMessage={coreAI.sendMessage}
        onConfirmAction={coreAI.confirmAction}
        isLoading={coreAI.isLoading}
        aiName={store.settings.coreAIName}
        onClearHistory={coreAI.clearHistory}
        currentView="categories"
      />
    </div>
  );
}
