package fit.kallo.app.todaywidget

import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.GregorianCalendar
import java.util.Locale

/**
 * The little formatting the widget must do itself, because it has to keep
 * working at midnight without the app: the date header and the dial figures of
 * a day the app has not written yet. Everything else arrives formatted. The
 * same three rules as `ios/TodayWidget/WidgetFormat.swift`.
 */
class WidgetFormat(identifier: String) {
  val locale: Locale = Locale.forLanguageTag(identifier.replace('_', '-'))

  /** Locale grouping, as the app's `formatCount` (en "1,932", vi "1.932"). */
  fun count(n: Int): String =
    NumberFormat.getIntegerInstance(locale).apply { isGroupingUsed = true }.format(n.toLong())

  /** The app's day header pattern, `DateFormat('EEE, MMM d', locale)`: "Wed, Nov 4". */
  fun dateHeader(millis: Long): String =
    SimpleDateFormat("EEE, MMM d", locale)
      .apply { calendar = GregorianCalendar(locale) }
      .format(Date(millis))

  companion object {
    /** Fill a `{name}` template from the app's l10n files. */
    fun fill(template: String, values: Map<String, String>): String =
      values.entries.fold(template) { text, (key, value) -> text.replace("{$key}", value) }
  }
}
