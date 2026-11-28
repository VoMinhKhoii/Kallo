package fit.kallo.app.todaywidget

import android.content.Context
import org.json.JSONException
import org.json.JSONObject
import java.util.Calendar
import java.util.GregorianCalendar
import java.util.Locale

/**
 * What the app hands the widget: one JSON string in home_widget's
 * SharedPreferences.
 *
 * Written by `lib/features/today_widget/` (Dart) after anything changes today's
 * meals or targets. The same shape the iOS extension decodes
 * (`ios/TodayWidget/TodaySnapshot.swift`): the widget never calls the network
 * and never formats a sentence of its own; every word arrives here, in the
 * language the user chose in Kallo.
 */
data class TodaySnapshot(
  val v: Int,
  /** The local day the totals belong to, `yyyy-MM-dd`. */
  val date: String,
  /** "en" or "vi": the language chosen in Kallo, not the phone's. */
  val locale: String,
  val signedIn: Boolean,
  val target: Macros,
  val eaten: Macros,
  /** Totals that left out a meal's unknown value. Each reads as a floor ("≥"). */
  val floors: List<String>,
  /** Today's meals, oldest first. */
  val meals: List<Meal>,
  val copy: Copy,
) {
  data class Macros(val kcal: Int, val protein: Int, val carbs: Int, val fat: Int) {
    companion object {
      val zero = Macros(0, 0, 0, 0)
    }
  }

  /** Time ("8:12") and kcal ("380 kcal") arrive formatted by the app. */
  data class Meal(val time: String, val text: String, val kcal: String)

  /** The app's own wording (`assets/l10n/<locale>.json`), resolved by the app. */
  data class Copy(
    val kcalEaten: String,
    val eatenShort: String,
    /** "{left}/{target} left" */
    val leftOfTarget: String,
    /** "{over} over {target}" */
    val overTargetBy: String,
    /** "{logged}/{target}": the short dial's bare fraction. */
    val fraction: String,
    val protein: String,
    val carbs: String,
    val fat: String,
    val signedOut: String,
  )

  /**
   * The day as it should be SHOWN on [day]: a snapshot written on an earlier
   * date is a new, empty day with the same targets, never yesterday's meals.
   */
  fun shownOn(day: String): TodaySnapshot =
    if (day == date) this
    else copy(date = day, eaten = Macros.zero, floors = emptyList(), meals = emptyList())

  /** [shownOn] the local day [millis] falls on. */
  fun shownAt(millis: Long): TodaySnapshot = shownOn(dayKey(millis))

  /** Number and date formatting in the language chosen in Kallo. */
  val format: WidgetFormat get() = WidgetFormat(locale)

  companion object {
    /**
     * Bumped when the shape changes; a widget reading another version shows
     * nothing rather than guessing.
     */
    const val VERSION = 1

    /**
     * `yyyy-MM-dd` for [millis] in the phone's time zone, on the Gregorian
     * calendar: the same key the app's `todayDateString()` builds.
     */
    fun dayKey(millis: Long): String {
      val c = GregorianCalendar().apply { timeInMillis = millis }
      return String.format(
        Locale.ROOT, "%04d-%02d-%02d",
        c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH),
      )
    }

    /** Throws on a malformed or partial snapshot; [TodaySnapshotStore.read] catches. */
    fun parse(json: String): TodaySnapshot {
      val o = JSONObject(json)
      fun macros(m: JSONObject) =
        Macros(m.getInt("kcal"), m.getInt("protein"), m.getInt("carbs"), m.getInt("fat"))
      val c = o.getJSONObject("copy")
      val floors = o.getJSONArray("floors")
      val meals = o.getJSONArray("meals")
      return TodaySnapshot(
        v = o.getInt("v"),
        date = o.getString("date"),
        locale = o.getString("locale"),
        signedIn = o.getBoolean("signedIn"),
        target = macros(o.getJSONObject("target")),
        eaten = macros(o.getJSONObject("eaten")),
        floors = List(floors.length()) { floors.getString(it) },
        meals = List(meals.length()) {
          val m = meals.getJSONObject(it)
          Meal(m.getString("time"), m.getString("text"), m.getString("kcal"))
        },
        copy = Copy(
          kcalEaten = c.getString("kcalEaten"),
          eatenShort = c.getString("eatenShort"),
          leftOfTarget = c.getString("leftOfTarget"),
          overTargetBy = c.getString("overTargetBy"),
          fraction = c.getString("fraction"),
          protein = c.getString("protein"),
          carbs = c.getString("carbs"),
          fat = c.getString("fat"),
          signedOut = c.getString("signedOut"),
        ),
      )
    }
  }
}

object TodaySnapshotStore {
  /** home_widget's own file (`HomeWidgetPlugin.PREFERENCES`), which `saveWidgetData` writes. */
  const val PREFERENCES = "HomeWidgetPreferences"

  /** `kTodayWidgetKey` in Dart. */
  const val KEY = "today.snapshot"

  fun read(context: Context): TodaySnapshot? {
    val json =
      context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(KEY, null)
        ?: return null
    return try {
      TodaySnapshot.parse(json).takeIf { it.v == TodaySnapshot.VERSION }
    } catch (_: JSONException) {
      null
    }
  }
}
