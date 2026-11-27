package fit.kallo.app.todaywidget

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
import fit.kallo.app.todaywidget.gauge.CalorieWording
import kotlin.math.sqrt

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
    TodayBoundary.schedule(context)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
    draw(context, manager, id)
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      // A theme switch or midnight, or the phone's clock or zone moved under us.
      TodayBoundary.ACTION, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
      Intent.ACTION_LOCALE_CHANGED -> redrawAll(context)
      else -> super.onReceive(context, intent)
    }
  }

  override fun onDisabled(context: Context) {
    TodayBoundary.cancel(context)
  }

  companion object {
    /** Debug builds only: force a theme for screenshots, as the iOS widget's `today.debugTheme`. */
    private const val DEBUG_THEME_KEY = "today.debugTheme"

    /** The widget's tap target: `isTodayWidgetLink` in Dart routes it to Today. */
    const val LINK = "nham://today"

    private fun redrawAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
      for (id in ids) draw(context, manager, id)
      if (ids.isNotEmpty()) TodayBoundary.schedule(context)
    }

    private fun draw(context: Context, manager: AppWidgetManager, id: Int) {
      val options = manager.getAppWidgetOptions(id)
      fun dp(key: String) = options.getInt(key).takeIf { it > 0 }
      // Portrait is the launcher's narrowest width and tallest height;
      // landscape the widest and shortest. Each gets a card drawn at its own
      // size, so neither is a stretched copy of the other.
      val portrait = SizeDp(
        dp(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) ?: 170,
        dp(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT) ?: 170,
      )
      val landscape = SizeDp(
        dp(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH) ?: portrait.width,
        dp(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT) ?: portrait.height,
      )
      val now = System.currentTimeMillis()
      // The day as it reads now: an earlier day's snapshot is an empty new day.
      val day = TodaySnapshotStore.read(context)?.shownAt(now)
      val renderer = TodayWidgetRenderer(context)
      val theme = theme(context, now)
      val description = describe(day)
      fun card(size: SizeDp, scale: Float) = RemoteViews(context.packageName, R.layout.today_widget).apply {
        val bitmap = renderer.render(day, now, size.width.toDouble(), size.height.toDouble(), theme, scale)
        setImageViewBitmap(R.id.today_widget_card, bitmap)
        setContentDescription(R.id.today_widget_card, description)
        setOnClickPendingIntent(R.id.today_widget_card, openToday(context))
      }
      val oneShape = landscape == portrait
      val scale = scaleWithinBudget(context, if (oneShape) listOf(portrait) else listOf(landscape, portrait))
      val views = if (oneShape) card(portrait, scale) else RemoteViews(card(landscape, scale), card(portrait, scale))
      try {
        manager.updateAppWidget(id, views)
      } catch (tooBig: IllegalArgumentException) {
        // The launcher refused the bitmaps after all (its budget is computed
        // from a display this one may not be): the portrait card alone, at
        // half the scale, rather than a receiver that throws on every update.
        Log.w("TodayWidget", "widget bitmaps refused; redrawing smaller", tooBig)
        try {
          manager.updateAppWidget(id, card(portrait, scale / 2))
        } catch (stillTooBig: IllegalArgumentException) {
          // Refused again: keep whatever the widget last showed. A broadcast
          // receiver that throws takes the app's process down with it.
          Log.w("TodayWidget", "smaller widget bitmap refused too; keeping the last card", stillTooBig)
        }
      }
    }

    /** A launcher-reported widget size, in dp. */
    private data class SizeDp(val width: Int, val height: Int)

    /**
     * Pixels per dp for this widget's cards: the screen density, or less when
     * the cards together would pass half the bitmap memory the system allows a
     * widget update (1.5 × the screen's own ARGB size), which a large card in
     * both orientations can on a small phone or a foldable's cover screen.
     */
    private fun scaleWithinBudget(context: Context, sizesDp: List<SizeDp>): Float {
      val metrics = context.resources.displayMetrics
      val budget = 0.5 * 1.5 * 4.0 * metrics.widthPixels * metrics.heightPixels
      val perScale2 = 4.0 * sizesDp.sumOf { it.width.toDouble() * it.height }
      val fit = sqrt(budget / perScale2).toFloat()
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

    /** What TalkBack reads for the card: the calorie dial's own words. */
    private fun describe(day: TodaySnapshot?): String? {
      day ?: return null
      if (!day.signedIn) return day.copy.signedOut
      val wording = CalorieWording.of(day, long = true)
      return "${wording.figure} ${wording.unit}, ${wording.detail}"
    }

    private fun openToday(context: Context): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(LINK)).setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      return PendingIntent.getActivity(
        context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
  }
}
