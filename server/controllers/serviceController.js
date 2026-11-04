import Service from '../models/Service.js';
import ServiceCategory from '../models/ServiceCategory.js';

export async function getServices(req, res) {
  try {
    const { category, search, sort } = req.query;
    const query = { isActive: true };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { description: regex }, { category: regex }];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'price_asc') sortOption = { price: 1 };
    if (sort === 'price_desc') sortOption = { price: -1 };
    if (sort === 'rating_desc') sortOption = { rating: -1 };

    const services = await Service.find(query).sort(sortOption);
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch services.' });
  }
}

export async function getServiceById(req, res) {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found.' });
    }
    res.json(service);
  } catch (err) {
    res.status(400).json({ message: 'Invalid service ID.' });
  }
}

export async function createService(req, res) {
  try {
    const { name, category, description, price, image, features } = req.body;
    if (!name || !category || !description || price == null) {
      return res.status(400).json({ message: 'Name, category, description, and price are required.' });
    }

    const categoryDoc = await ServiceCategory.findOne({ name: category.trim() });

    const newService = await Service.create({
      name: name.trim(),
      category: category.trim(),
      categoryId: categoryDoc?._id || null,
      description: description.trim(),
      price: Number(price),
      image: image || '/assets/prototype/image4.jpeg',
      features: Array.isArray(features) ? features : [features]
    });

    res.status(201).json({
      success: true,
      message: 'Service created successfully.',
      service: newService
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create service.' });
  }
}

export async function updateService(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;
    const service = await Service.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!service) return res.status(404).json({ message: 'Service not found.' });
    res.json({ success: true, message: 'Service updated.', service });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update service.' });
  }
}

export async function deleteService(req, res) {
  try {
    const { id } = req.params;
    await Service.findByIdAndDelete(id);
    res.json({ success: true, message: 'Service deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete service.' });
  }
}
