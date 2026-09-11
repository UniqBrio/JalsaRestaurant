/**
 * analytics/examples - four businesses, one component set, zero component edits.
 *
 * THIS FILE IS THE PROOF, NOT A FEATURE
 *   If a restaurant, a gym, an academy and a court-booking business can each be expressed as a
 *   config object here, the components are genuinely business-agnostic. The day one of them
 *   needs a component changed to fit, the config model is missing a field - and THAT is the
 *   defect, not the domain.
 *
 * Copy the nearest one into a new application, rename the metrics, point `dataSource` at real
 * entities. That is the whole integration.
 */
import type { DashboardConfig } from './dashboard';

const currency = { format: 'currency' as const, formatOptions: { compactStyle: 'in' as const } };

/** Restaurant - today is the unit of time; the question is "how is service going right now?" */
export const restaurantDashboard: DashboardConfig = {
  id: 'restaurant',
  title: 'Today',
  subtitle: 'Service, orders and revenue',
  defaultBreakdown: ['category', 'item', 'order'],
  filters: [
    { field: 'date', label: 'Date', kind: 'date' },
    { field: 'payment_method', label: 'Payment', kind: 'multiselect' },
  ],
  metrics: [
    {
      id: 'revenue_today',
      label: "Today's revenue",
      dataSource: 'orders',
      aggregation: 'sum',
      field: 'total',
      ...currency,
      comparisonPeriod: 'previous_period',
      priority: 'primary',
      visualization: 'sparkline',
      breakdown: ['category', 'item', 'order'],
      actions: [{ id: 'view_orders', label: 'View orders' }],
    },
    {
      id: 'orders_count',
      label: 'Orders',
      dataSource: 'orders',
      aggregation: 'count',
      format: 'count',
      comparisonPeriod: 'previous_period',
      priority: 'primary',
    },
    {
      id: 'avg_order_value',
      label: 'Average order',
      dataSource: 'orders',
      aggregation: 'avg',
      field: 'total',
      ...currency,
      comparisonPeriod: 'previous_period',
      priority: 'primary',
    },
    {
      id: 'pending_orders',
      label: 'Pending',
      dataSource: 'orders',
      aggregation: 'count',
      format: 'count',
      higherIsBetter: false,
      priority: 'primary',
      description: 'Orders placed but not yet served',
    },
    {
      id: 'cancelled_orders',
      label: 'Cancelled',
      dataSource: 'orders',
      aggregation: 'count',
      format: 'count',
      higherIsBetter: false,
      priority: 'secondary',
      comparisonPeriod: 'previous_period',
    },
  ],
  sections: [
    {
      id: 'kpis',
      kind: 'metrics',
      items: ['revenue_today', 'orders_count', 'avg_order_value', 'pending_orders'],
      order: 1,
    },
    {
      id: 'attention',
      kind: 'insights',
      title: 'Needs attention',
      order: 2,
      question: 'What should I deal with before the next rush?',
    },
    {
      id: 'top_items',
      kind: 'chart',
      title: 'Top menu items',
      order: 3,
      question: 'What is selling, and what is not moving?',
    },
    {
      id: 'recent',
      kind: 'table',
      title: 'Recent orders',
      order: 4,
      question: 'What exactly happened, order by order?',
    },
  ],
};

/** Gym - the month is the unit; the question is "is the membership base healthy?" */
export const gymDashboard: DashboardConfig = {
  id: 'gym',
  title: 'This month',
  subtitle: 'Members, revenue and attendance',
  defaultBreakdown: ['plan', 'member', 'payment'],
  filters: [
    { field: 'date', label: 'Period', kind: 'date' },
    { field: 'plan', label: 'Plan', kind: 'multiselect' },
    { field: 'trainer', label: 'Trainer', kind: 'multiselect' },
  ],
  metrics: [
    {
      id: 'revenue_month',
      label: 'Revenue',
      dataSource: 'payments',
      aggregation: 'sum',
      field: 'amount',
      ...currency,
      comparisonPeriod: 'previous_period',
      target: 250000,
      priority: 'primary',
      visualization: 'sparkline',
      breakdown: ['plan', 'member', 'payment'],
    },
    {
      id: 'active_members',
      label: 'Active members',
      dataSource: 'members',
      aggregation: 'distinct',
      field: 'id',
      format: 'count',
      comparisonPeriod: 'previous_period',
      priority: 'primary',
    },
    {
      id: 'new_memberships',
      label: 'New this month',
      dataSource: 'members',
      aggregation: 'count',
      format: 'count',
      comparisonPeriod: 'previous_period',
      priority: 'primary',
    },
    {
      id: 'expiring',
      label: 'Expiring in 7 days',
      dataSource: 'members',
      aggregation: 'count',
      format: 'count',
      higherIsBetter: false,
      priority: 'primary',
      actions: [{ id: 'view_expiring', label: 'View list' }],
    },
    {
      id: 'outstanding',
      label: 'Outstanding',
      dataSource: 'payments',
      aggregation: 'sum',
      field: 'due',
      ...currency,
      higherIsBetter: false,
      priority: 'secondary',
    },
    {
      id: 'attendance_rate',
      label: 'Attendance',
      dataSource: 'sessions',
      aggregation: 'percentage',
      field: 'attended',
      denominatorField: 'scheduled',
      format: 'percent',
      comparisonPeriod: 'previous_period',
      priority: 'secondary',
    },
    {
      id: 'target_progress',
      label: 'Monthly target',
      dataSource: 'payments',
      aggregation: 'sum',
      field: 'amount',
      ...currency,
      target: 250000,
      visualization: 'progress',
      priority: 'secondary',
    },
  ],
  sections: [
    {
      id: 'kpis',
      kind: 'metrics',
      items: ['revenue_month', 'active_members', 'new_memberships', 'expiring'],
      order: 1,
    },
    {
      id: 'attention',
      kind: 'insights',
      title: 'Needs attention',
      order: 2,
      question: 'Who is about to lapse, and who owes money?',
    },
    {
      id: 'goal',
      kind: 'metrics',
      items: ['target_progress', 'attendance_rate', 'outstanding'],
      title: 'Health',
      order: 3,
    },
    { id: 'members', kind: 'table', title: 'Members', order: 4, question: 'Which specific members need contacting?' },
  ],
};

/** Academy (sports / arts / music / coaching) - students, courses, fees, attendance. */
export const academyDashboard: DashboardConfig = {
  id: 'academy',
  title: 'This month',
  subtitle: 'Students, fees and attendance',
  defaultBreakdown: ['course', 'batch', 'student', 'transaction'],
  filters: [
    { field: 'date', label: 'Period', kind: 'date' },
    { field: 'course', label: 'Course', kind: 'multiselect' },
    { field: 'instructor', label: 'Instructor', kind: 'multiselect' },
  ],
  metrics: [
    // Money metrics carry visibleTo on the METRIC, not only on the section that renders them.
    // Gating the section alone leaves the figure in `config.metrics`, so a host that iterates
    // metrics still computes and fetches it - hidden on screen, present in the payload. The
    // guarantee is only real when the metric itself is removed.
    {
      id: 'fees_collected',
      label: 'Fees collected',
      dataSource: 'payments',
      aggregation: 'sum',
      field: 'amount',
      ...currency,
      comparisonPeriod: 'previous_period',
      priority: 'primary',
      visualization: 'sparkline',
      breakdown: ['course', 'student', 'transaction'],
      visibleTo: ['owner', 'manager'],
    },
    {
      id: 'active_students',
      label: 'Active students',
      dataSource: 'students',
      aggregation: 'distinct',
      field: 'id',
      format: 'count',
      comparisonPeriod: 'previous_period',
      priority: 'primary',
    },
    {
      id: 'new_registrations',
      label: 'New registrations',
      dataSource: 'students',
      aggregation: 'count',
      format: 'count',
      comparisonPeriod: 'previous_period',
      priority: 'primary',
    },
    {
      id: 'fees_outstanding',
      label: 'Outstanding fees',
      dataSource: 'payments',
      aggregation: 'sum',
      field: 'due',
      ...currency,
      higherIsBetter: false,
      priority: 'primary',
      actions: [{ id: 'view_dues', label: 'View dues' }],
      visibleTo: ['owner', 'manager'],
    },
    {
      id: 'attendance_rate',
      label: 'Attendance',
      dataSource: 'attendance',
      aggregation: 'percentage',
      field: 'present',
      denominatorField: 'scheduled',
      format: 'percent',
      comparisonPeriod: 'previous_period',
      priority: 'secondary',
      // An instructor sees their own teaching metrics; fee figures stay with the owner.
      visibleTo: ['owner', 'manager', 'instructor'],
    },
  ],
  sections: [
    {
      id: 'kpis',
      kind: 'metrics',
      items: ['fees_collected', 'active_students', 'new_registrations', 'fees_outstanding'],
      order: 1,
      visibleTo: ['owner', 'manager'],
    },
    { id: 'teaching', kind: 'metrics', items: ['attendance_rate'], title: 'Teaching', order: 2 },
    {
      id: 'attention',
      kind: 'insights',
      title: 'Needs attention',
      order: 3,
      question: 'Which students are falling behind or overdue?',
    },
    {
      id: 'courses',
      kind: 'chart',
      title: 'Course performance',
      order: 4,
      question: 'Which courses are filling, and which are fading?',
    },
    { id: 'students', kind: 'table', title: 'Students', order: 5, question: 'Who exactly, and what do they owe?' },
  ],
};

/** Badminton / court booking - utilisation is the metric a facility lives or dies by. */
export const badmintonDashboard: DashboardConfig = {
  id: 'badminton',
  title: 'This week',
  subtitle: 'Bookings, utilisation and revenue',
  defaultBreakdown: ['court', 'slot', 'booking', 'customer'],
  filters: [
    { field: 'date', label: 'Period', kind: 'date' },
    { field: 'court', label: 'Court', kind: 'multiselect' },
    { field: 'booking_type', label: 'Type', kind: 'multiselect' },
  ],
  metrics: [
    {
      id: 'revenue_week',
      label: 'Revenue',
      dataSource: 'bookings',
      aggregation: 'sum',
      field: 'amount',
      ...currency,
      comparisonPeriod: 'previous_period',
      priority: 'primary',
      visualization: 'sparkline',
      breakdown: ['court', 'booking', 'customer'],
    },
    {
      id: 'bookings_count',
      label: 'Bookings',
      dataSource: 'bookings',
      aggregation: 'count',
      format: 'count',
      comparisonPeriod: 'previous_period',
      priority: 'primary',
    },
    {
      id: 'utilisation',
      label: 'Court utilisation',
      dataSource: 'slots',
      aggregation: 'percentage',
      field: 'booked_hours',
      denominatorField: 'available_hours',
      format: 'percent',
      comparisonPeriod: 'previous_period',
      target: 70,
      priority: 'primary',
      visualization: 'progress',
    },
    {
      id: 'cancellations',
      label: 'Cancellations',
      dataSource: 'bookings',
      aggregation: 'count',
      format: 'count',
      higherIsBetter: false,
      comparisonPeriod: 'previous_period',
      priority: 'primary',
    },
    {
      id: 'outstanding',
      label: 'Unpaid bookings',
      dataSource: 'bookings',
      aggregation: 'sum',
      field: 'due',
      ...currency,
      higherIsBetter: false,
      priority: 'secondary',
    },
  ],
  sections: [
    {
      id: 'kpis',
      kind: 'metrics',
      items: ['revenue_week', 'bookings_count', 'utilisation', 'cancellations'],
      order: 1,
    },
    {
      id: 'attention',
      kind: 'insights',
      title: 'Needs attention',
      order: 2,
      question: 'Which slots are going empty, and who has not paid?',
    },
    {
      id: 'peak',
      kind: 'chart',
      title: 'Busiest hours',
      order: 3,
      question: 'When should I price higher, and when should I run offers?',
    },
    {
      id: 'bookings',
      kind: 'table',
      title: 'Bookings',
      order: 4,
      question: 'Which booking, which customer, what is owed?',
    },
  ],
};

export const exampleDashboards = {
  restaurant: restaurantDashboard,
  gym: gymDashboard,
  academy: academyDashboard,
  badminton: badmintonDashboard,
} as const;
