const WeekPlan = require('../models/WeekPlan');
const ApiError = require('../utils/ApiError');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getWeekStart = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - now.getDay());
  return start;
};

const defaultDays = () => ({
  Sun: [{ time: 'Morning', event: 'Weekend Reset', outfit: 'Comfy Basics', sub: 'Tee + Joggers', status: 'pending' }],
  Mon: [{ time: 'Morning', event: 'Work Start', outfit: 'Office Smart', sub: 'Shirt + Trousers', status: 'pending' }],
  Tue: [{ time: 'Evening', event: 'Gym', outfit: 'Active Set', sub: 'Breathable top + leggings', status: 'pending' }],
  Wed: [{ time: 'Evening', event: 'Dinner', outfit: 'Casual Chic', sub: 'Blazer + denim', status: 'pending' }],
  Thu: [{ time: 'Morning', event: 'Errands', outfit: 'Street Casual', sub: 'Sneakers + jacket', status: 'pending' }],
  Fri: [{ time: 'Night', event: 'Night Out', outfit: 'Statement Look', sub: 'Layered look + boots', status: 'pending' }],
  Sat: [{ time: 'Afternoon', event: 'Brunch', outfit: 'Weekend Fit', sub: 'Linen shirt + chinos', status: 'pending' }],
});

const mapPlan = (plan) => {
  const mapped = {};
  DAYS.forEach((day) => {
    mapped[day] = (plan.days?.[day] || []).map((item) => ({
      id: item._id,
      time: item.time,
      event: item.event,
      outfit: item.outfit,
      sub: item.sub,
      status: item.status,
    }));
  });
  return mapped;
};

const getOrCreateWeekPlan = async (userId) => {
  const weekOf = getWeekStart();
  let plan = await WeekPlan.findOne({ userId, weekOf });

  if (!plan) {
    plan = await WeekPlan.create({ userId, weekOf, days: defaultDays() });
  }

  return plan;
};

exports.getWeekPlan = async (req, res, next) => {
  try {
    const plan = await getOrCreateWeekPlan(req.user._id);
    res.status(200).json({ success: true, weekOf: plan.weekOf, days: mapPlan(plan) });
  } catch (error) {
    next(error);
  }
};

exports.toggleWeekPlanItem = async (req, res, next) => {
  try {
    const { day, itemId } = req.params;
    if (!DAYS.includes(day)) {
      return next(new ApiError('Invalid day value', 400));
    }

    const plan = await getOrCreateWeekPlan(req.user._id);
    const dayItems = plan.days?.[day] || [];
    const target = dayItems.id(itemId);

    if (!target) {
      return next(new ApiError('Plan item not found', 404));
    }

    target.status = target.status === 'ready' ? 'pending' : 'ready';
    await plan.save();

    res.status(200).json({ success: true, item: { id: target._id, status: target.status } });
  } catch (error) {
    next(error);
  }
};

exports.addWeekPlanItem = async (req, res, next) => {
  try {
    const { day } = req.params;
    const { time, event, outfit, sub, status } = req.body;

    if (!DAYS.includes(day)) {
      return next(new ApiError('Invalid day value', 400));
    }

    if (!outfit || !outfit.trim()) {
      return next(new ApiError('Outfit name is required', 400));
    }

    const plan = await getOrCreateWeekPlan(req.user._id);

    if (!plan.days) {
      plan.days = {};
    }

    if (!plan.days[day]) {
      plan.days[day] = [];
    }

    const item = {
      time: time?.trim() || 'Anytime',
      event: event?.trim() || 'Planned Look',
      outfit: outfit.trim(),
      sub: sub?.trim() || 'Custom outfit plan',
      status: status === 'ready' ? 'ready' : 'pending',
    };

    plan.days[day].push(item);
    await plan.save();

    const created = plan.days[day][plan.days[day].length - 1];

    res.status(201).json({
      success: true,
      item: {
        id: created._id,
        time: created.time,
        event: created.event,
        outfit: created.outfit,
        sub: created.sub,
        status: created.status,
      },
    });
  } catch (error) {
    next(error);
  }
};
