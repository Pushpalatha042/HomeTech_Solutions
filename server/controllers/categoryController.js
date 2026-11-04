import ServiceCategory from '../models/ServiceCategory.js';

export async function getCategories(req, res) {
  try {
    const categories = await ServiceCategory.find({ isActive: true }).sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch categories.' });
  }
}

export async function createCategory(req, res) {
  try {
    const { name, description = '', icon = 'Wrench' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required.' });
    }
    const cat = await ServiceCategory.create({
      name: name.trim(),
      description: description.trim(),
      icon: icon.trim()
    });
    res.status(201).json({ success: true, message: 'Category created.', category: cat });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A category with this name already exists.' });
    }
    res.status(500).json({ message: 'Failed to create category.' });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, description, icon, isActive } = req.body;
    const cat = await ServiceCategory.findByIdAndUpdate(
      id,
      { $set: { name, description, icon, isActive } },
      { new: true }
    );
    res.json({ success: true, message: 'Category updated.', category: cat });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update category.' });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    await ServiceCategory.findByIdAndDelete(id);
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete category.' });
  }
}
