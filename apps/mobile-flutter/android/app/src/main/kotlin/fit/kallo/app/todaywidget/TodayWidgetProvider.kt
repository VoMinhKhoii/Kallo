package fit.kallo.app.todaywidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.RemoteViews
import fit.kallo.app.R
import java.util.Calendar

/**
 * Kallo's home-screen "Today" widget on Android: the iOS widget's three sizes,
 * drawn the same way. Docs: `apps/docs/mobile/today-widget.md`.
 *
 * The app writes the day (`lib/features/today_widget/`) through `home_widget`,
 * which saves the JSON and broadcasts an update to this class by its full name
 * (`kTodayWidgetAndroidProvider` in Dart). This side only reads and draws.
 */
class TodayWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    for (id in ids) draw(context, manager, id)
    scheduleNextBoundary(context)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    draw(context, manager, id)
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      // A theme switch or midnight, or the phone's clock or zone moved under us.
      ACTION_BOUNDARY, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_LOCALE_CHANGED -> redrawAll(context)
      else -> super.onReceive(context, intent)
    }
  }

  override fun onDisabled(context: Context) {
    alarms(context).cancel(boundaryIntent(context))
  }

  companion object {
    private const val ACTION_BOUNDARY = "fit.kallo.app.todaywidget.BOUNDARY"

    /** Debug builds only: force a theme for screenshots, as the iOS widget's `today.debugTheme`. */
    private const val DEBUG_THEME_KEY = "today.debugTheme"

    /** The widget's tap target: `isTodayWidgetLink` in Dart routes it to Today. */
    const val LINK = "nham://today"

    private fun redrawAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
      for (id in ids) draw(context, manager, id)
      if (ids.isNotEmpty()) scheduleNextBoundary(context)
    }

    private fun draw(context: Context, manager: AppWidgetManager, id: Int) {
      val options = manager.getAppWidgetOptions(id)
      fun dp(key: String) = options.getInt(key).takeIf { it > 0 }
      // Portrait is the launcher's narrowest width and tallest height;
      // landscape the widest and shortest. Each gets a card drawn at its own
      // size, so neither is a stretched copy of the other.
      val portrait = Pair(
        dp(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) ?: 170,
        dp(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT) ?: 170,
      )
      val landscape = Pair(
        dp(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH) ?: portrait.first,
        dp(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT) ?: portrait.second,
      )
      val now = System.currentTimeMillis()
      val snapshot = TodaySnapshotStore.read(context)
      val renderer = TodayWidgetRenderer(context)
      val theme = theme(context, now)
      val description = describe(snapshot?.shownOn(TodaySnapshotStore.dayKey(now)))
      fun card(size: Pair<Int, Int>, scale: Float) = RemoteViews(context.packageName, R.layout.today_widget).apply {
        val bitmap = renderer.render(snapshot, now, size.first.toDouble(), size.second.toDouble(), theme, scale)
        setImageViewBitmap(R.id.today_widget_card, bitmap)
        setContentDescription(R.id.today_widget_card, description)
        setOnClickPendingIntent(R.id.today_widget_card, openToday(context))
      }
      val sizes = if (landscape == portrait) listOf(portrait) else listOf(landscape, portrait)
      val scale = scaleWithinBudget(context, sizes)
      val views = if (sizes.size == 1) card(portrait, scale) else RemoteViews(card(landscape, scale), card(portrait, scale))
      try {
        manager.updateAppWidget(id, views)
      } catch (tooBig: IllegalArgumentException) {
        // The launcher refused the bitmaps after all (its budget is computed
        // from a display this one may not be): the portrait card alone, at
        // half the scale, rather than a receiver that throws on every update.
        Log.w("TodayWidget", "widget bitmaps refused; redrawing smaller", tooBig)
        manager.updateAppWidget(id, card(portrait, scale / 2))
      }
    }

    /**
     * Pixels per dp for this widget's cards: the screen density, or less when
     * the cards together would pass half the bitmap memory the system allows a
     * widget update (1.5 × the screen's own ARGB size), which a large card in
     * both orientations can on a small phone or a foldable's cover screen.
     */
    private fun scaleWithinBudget(context: Context, sizesDp: List<Pair<Int, Int>>): Float {
      val metrics = context.resources.displayMetrics
      val budget = 0.5 * 1.5 * 4.0 * metrics.widthPixels * metrics.heightPixels
      val perScale2 = 4.0 * sizesDp.sumOf { (w, h) -> w.toDouble() * h }
      val fit = kotlin.math.sqrt(budget / perScale2).toFloat()
      return minOf(metrics.density, fit)
    }

    private fun theme(context: Context, now: Long): WidgetTheme {
      if (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
        val forced = context.getSharedPreferences(TodaySnapshotStore.PREFERENCES, Context.MODE_PRIVATE)
          .getString(DEBUG_THEME_KEY, null)
        if (forced == "light") return WidgetTheme.light
        if (forced == "aurora") return WidgetTheme.aurora
      }
      return WidgetTheme.at(now)
    }

    /** What TalkBack reads for the card: the dial's own words. */
    private fun describe(day: TodaySnapshot?): String? {
      day ?: return null
      if (!day.signedIn) return day.copy.signedOut
      val wording = fit.kallo.app.todaywidget.gauge.CalorieWording.of(
        day.eaten.kcal, day.target.kcal, "kcal" in day.floors, true, day.copy, WidgetFormat(day.locale),
      )
      return "${wording.figure} ${wording.unit}, ${wording.detail}"
    }

    private fun openToday(context: Context): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(LINK)).setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      return PendingIntent.getActivity(
        context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    private fun alarms(context: Context) = context.getSystemService(AlarmManager::class.java)

    private fun boundaryIntent(context: Context): PendingIntent =
      PendingIntent.getBroadcast(
        context, 0,
        Intent(context, TodayWidgetProvider::class.java).setAction(ACTION_BOUNDARY),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    /**
     * One inexact alarm at the next theme switch (06:00, 18:00) or midnight, so
     * the date, the theme and an empty new day change with the app closed; each
     * one redraws and sets the next. Inexact needs no exact-alarm permission and
     * may land a few minutes late, which a date header can afford.
     */
    private fun scheduleNextBoundary(context: Context) {
      alarms(context).set(AlarmManager.RTC, nextBoundary(System.currentTimeMillis()), boundaryIntent(context))
    }

    /** The first of midnight, 06:00 and 18:00 strictly after [now], local time. */
    fun nextBoundary(now: Long): Long {
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
  }
}
