import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Things handed to the logging feed by a surface that is not the feed.
///
/// All three are session slots rather than route parameters, for one reason:
/// `/logging` is a shell branch that is often ALREADY mounted, so a query
/// param would have to be re-read on every rebuild of the same location with
/// nothing to mark it consumed — and the feed frequently is NOT mounted yet
/// when the value is produced, because the profile fetch gates it behind a
/// skeleton. Parking the value lets the feed claim it on its first build,
/// whenever that turns out to be.
///
/// Each has exactly one consumer, and each consumer nulls its slot the instant
/// it claims it, so a rebuild, a tab switch back or a hot reload cannot
/// re-fire what the user already saw happen.

/// A meal composed somewhere OTHER than the feed — the dashboard's quick-log
/// sheet, the first-run suggestion chips — parked here on the way to `/logging`.
///
/// A session provider rather than a `?meal=` query parameter for two reasons:
/// `/logging` is a shell branch that is often ALREADY mounted (a query param
/// would have to be re-read on every rebuild of the same location, with nothing
/// to mark it consumed), and the feed frequently is NOT mounted yet when the
/// text is produced — the profile fetch gates it behind a skeleton. Parking the
/// text lets the feed claim it on its first build, whenever that turns out to
/// be.
///
/// Exactly one consumer: [FeedArea], which nulls the slot the instant it claims
/// it, so a rebuild, a tab switch back or a hot reload cannot re-fire it.
final pendingMealProvider = StateProvider<String?>((ref) => null);

/// A day (YYYY-MM-DD) the feed should jump to, parked on its way in.
///
/// The sibling of [pendingMealProvider], and it exists for the same reason:
/// [LoggingScreen] keeps `_selectedDate` in State so paging back to last
/// Tuesday survives a tab switch, and `pushOverShell` early-returns when the
/// route is already open. So "take me to the logging feed" alone can land on
/// whatever day the user was last looking at.
///
/// That is fine for composing a meal, which always means today. It is wrong
/// for taking a cheat share: the staged slider card is stamped at the SOURCE
/// meal's instant, so landing on today would show an empty feed and a card the
/// recipient cannot find.
///
/// Exactly one consumer: [LoggingScreen], which nulls the slot as it claims it.
final pendingLoggingDayProvider = StateProvider<String?>((ref) => null);

/// A message the user asked to EDIT, parked on its way back into the composer.
///
/// The sibling of [pendingMealProvider], and deliberately a separate slot
/// because the two mean opposite things by "here is some meal text": parking a
/// pending meal RUNS it, while parking a refill only puts it in the field for
/// the user to change and send themselves. Collapsing them would make
/// long-pressing a message re-analyse it on the spot — the one thing the Edit
/// action exists to avoid.
///
/// Written by [UserMessageBubble]'s long-press menu, which sits arbitrarily
/// deep in the card list and in the live turn's footer; a slot rather than a
/// drilled callback for the same reason [pendingMealProvider] is one. Exactly
/// one consumer: [FeedArea], which empties it the instant it claims it, so a
/// rebuild cannot overwrite what the user has since typed.
final composerRefillProvider = StateProvider<String?>((ref) => null);
