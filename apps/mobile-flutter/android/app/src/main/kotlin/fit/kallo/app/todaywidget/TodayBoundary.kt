package fit.kallo.app.todaywidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.util.Calendar

/**
 * The widget's clock: one inexact alarm at the next theme switch (06:00,
 * 18:00) or midnight, so the date, the theme and an empty new day change with
 * the app closed. Each alarm reaches [TodayWidgetProvider] as [ACTION], which
 * redraws and sets the next. Inexact needs no exact-alarm permission and may
 * land a few minutes late, which a date header can afford.
 */
object TodayBoundary {
  const val ACTION = "fit.kallo.app.todaywidget.BOUNDARY"

  fun schedule(context: Context) {
    alarms(context).set(AlarmManager.RTC, next(System.currentTimeMillis()), intent(context))
  }

  fun cancel(context: Context) {
    alarms(context).cancel(intent(context))
  }

  /** The first of midnight, 06:00 and 18:00 strictly after [now], local time. */
  fun next(now: Long): Long {
    val day = Calendar.getInstance().apply {
      timeInMillis = now
      set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
    }
    for (offset in 0..1) {
      for (hour in listOf(0, WidgetTheme.LIGHT_FROM, WidgetTheme.LIGHT_UNTIL)) {
        val at = (day.clone() as Calendar).apply {
          add(Calendar.DAY_OF_MONTH, offset); set(Calendar.HOUR_OF_DAY, hour)
        }
        if (at.timeInMillis > now) return at.timeInMillis
      }
    }
    return now + 6 * 60 * 60 * 1000L
  }

  private fun alarms(context: Context) = context.getSystemService(AlarmManager::class.java)

  private fun intent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context, 0,
      Intent(context, TodayWidgetProvider::class.java).setAction(ACTION),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
