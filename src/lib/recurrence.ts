import { addDays, addMonths, addWeeks, isAfter, isBefore } from 'date-fns'
import { RecurrenceFormData } from './schemas'

// Maximum occurrences to generate when end_type is "never"
const MAX_OCCURRENCES_INFINITE = 156 // ~3 years weekly
const MAX_OCCURRENCES_TOTAL = 365 // Hard cap

export interface GenerateOccurrencesParams {
  startAt: Date
  recurrence: Omit<RecurrenceFormData, 'enabled'>
}

/**
 * Generates an array of Date objects representing each occurrence of a recurring session.
 * The first occurrence is the startAt date itself.
 */
export function generateOccurrences({
  startAt,
  recurrence,
}: GenerateOccurrencesParams): Date[] {
  const occurrences: Date[] = []
  const { frequency, interval_value, interval_unit, days_of_week, end_type, end_count, end_date } =
    recurrence

  const maxCount =
    end_type === 'count' && end_count
      ? Math.min(end_count, MAX_OCCURRENCES_TOTAL)
      : end_type === 'never'
        ? MAX_OCCURRENCES_INFINITE
        : MAX_OCCURRENCES_TOTAL

  const endDateObj = end_type === 'until' && end_date ? new Date(end_date + 'T23:59:59') : null

  // For weekly/biweekly with multiple days_of_week, we generate by week and pick days
  if ((frequency === 'weekly' || frequency === 'biweekly') && days_of_week.length > 0) {
    const weekInterval = frequency === 'biweekly' ? 2 : 1
    const startDayOfWeek = startAt.getDay()
    const sortedDays = [...days_of_week].sort()

    // Always include the starting date as first occurrence
    occurrences.push(new Date(startAt))

    let currentWeekStart = new Date(startAt)
    // Move to start of week (Sunday)
    currentWeekStart.setDate(currentWeekStart.getDate() - startDayOfWeek)

    let weekIndex = 0
    while (occurrences.length < maxCount) {
      // Move to next week (or 2 weeks for biweekly)
      const nextWeekStart = addDays(currentWeekStart, 7 * weekInterval)
      currentWeekStart = nextWeekStart
      weekIndex++

      let addedAny = false
      for (const dow of sortedDays) {
        const candidate = new Date(currentWeekStart)
        candidate.setDate(candidate.getDate() + dow)
        candidate.setHours(startAt.getHours(), startAt.getMinutes(), 0, 0)

        // Skip if before the start date
        if (isBefore(candidate, startAt)) continue
        // Skip if after the end date
        if (endDateObj && isAfter(candidate, endDateObj)) {
          return occurrences
        }
        // Skip if same as start (duplicate first)
        if (candidate.getTime() === startAt.getTime()) continue

        occurrences.push(candidate)
        addedAny = true

        if (occurrences.length >= maxCount) return occurrences
      }

      // Safety: if we didn't add anything for too many weeks, stop
      if (!addedAny && weekIndex > 200) break
    }

    return occurrences
  }

  // Monthly recurrence
  if (frequency === 'monthly') {
    let next = new Date(startAt)
    while (occurrences.length < maxCount) {
      if (endDateObj && isAfter(next, endDateObj)) break
      occurrences.push(new Date(next))
      next = addMonths(next, interval_value || 1)
    }
    return occurrences
  }

  // Custom recurrence
  if (frequency === 'custom') {
    let next = new Date(startAt)
    while (occurrences.length < maxCount) {
      if (endDateObj && isAfter(next, endDateObj)) break
      occurrences.push(new Date(next))
      if (interval_unit === 'day') next = addDays(next, interval_value)
      else if (interval_unit === 'week') next = addWeeks(next, interval_value)
      else next = addMonths(next, interval_value)
    }
    return occurrences
  }

  // Fallback: weekly without days_of_week
  if (frequency === 'weekly' || frequency === 'biweekly') {
    const weekInterval = frequency === 'biweekly' ? 2 : 1
    let next = new Date(startAt)
    while (occurrences.length < maxCount) {
      if (endDateObj && isAfter(next, endDateObj)) break
      occurrences.push(new Date(next))
      next = addWeeks(next, weekInterval)
    }
    return occurrences
  }

  return occurrences
}

export function describeRecurrence(recurrence: Omit<RecurrenceFormData, 'enabled'>): string {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']
  const { frequency, interval_value, interval_unit, days_of_week, end_type, end_count, end_date } =
    recurrence

  let base = ''
  if (frequency === 'weekly') {
    base =
      days_of_week.length > 0
        ? `Ogni settimana il ${days_of_week.map((d) => dayNames[d]).join(', ')}`
        : 'Ogni settimana'
  } else if (frequency === 'biweekly') {
    base =
      days_of_week.length > 0
        ? `Ogni due settimane il ${days_of_week.map((d) => dayNames[d]).join(', ')}`
        : 'Ogni due settimane'
  } else if (frequency === 'monthly') {
    base = 'Ogni mese'
  } else if (frequency === 'custom') {
    const unit =
      interval_unit === 'day'
        ? interval_value === 1
          ? 'giorno'
          : 'giorni'
        : interval_unit === 'week'
          ? interval_value === 1
            ? 'settimana'
            : 'settimane'
          : interval_value === 1
            ? 'mese'
            : 'mesi'
    base = `Ogni ${interval_value} ${unit}`
  }

  let ending = ''
  if (end_type === 'count' && end_count) {
    ending = `, per ${end_count} occorrenze`
  } else if (end_type === 'until' && end_date) {
    ending = `, fino al ${end_date}`
  } else if (end_type === 'never') {
    ending = ', a tempo indeterminato'
  }

  return base + ending
}
