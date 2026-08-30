# Changelog

## [1.13.0](https://github.com/VoMinhKhoii/Kallo/compare/v1.12.0...v1.13.0) (2026-08-30)


### Features

* **activity:** Threads-style activity page, nav entries and unread badges ([43a4515](https://github.com/VoMinhKhoii/Kallo/commit/43a4515fc104882e23db37d618e2f6fe3aaea17d))
* **api:** harden agent-facing contracts ([eb0c262](https://github.com/VoMinhKhoii/Kallo/commit/eb0c2623eb455b758491f1fcef2db04e761978f1))
* **billing:** premium-tier gating across web and mobile ([487941f](https://github.com/VoMinhKhoii/Kallo/commit/487941f45c6b2e80ec55ba0119ad1b5bc746e040))
* **billing:** re-enable copy/split under an initiator-pays gate ([f520488](https://github.com/VoMinhKhoii/Kallo/commit/f520488b401694bebe50b6388204d50968a6d9ba))
* **gauge:** size the day's marks from the room they get ([c5cd091](https://github.com/VoMinhKhoii/Kallo/commit/c5cd091e95928cb476208975aa83d586999c495b))
* **gauge:** size the day's marks from the room they get ([9737705](https://github.com/VoMinhKhoii/Kallo/commit/973770598ad556a803299dac765f844f3fa01b4e))
* **logging:** staged-meal discard, message copy, and dialog/perf fixes ([d2196a7](https://github.com/VoMinhKhoii/Kallo/commit/d2196a785cefe5087beff78e7fb8d883e9b7dc54))
* **mobile:** let a staged meal be discarded; fix the composer's tail ([d7432e8](https://github.com/VoMinhKhoii/Kallo/commit/d7432e8e8d37a61b463e4009cad1bb8aa2ff9eaf))
* **mobile:** press and hold a sent message to copy it ([1540576](https://github.com/VoMinhKhoii/Kallo/commit/154057681519cf11b905ce9e761fe2de86eae8d6))
* **notifications:** schema, aggregation write path, producers, API and hooks ([7777fb4](https://github.com/VoMinhKhoii/Kallo/commit/7777fb4e2ef2206ecaa96e998e9efec18986bf8f))
* **nutrition:** explain the complete-day rule on the day summary card ([b383ff0](https://github.com/VoMinhKhoii/Kallo/commit/b383ff0f325bd8ed8626e7c40f3ad22e5ace20a8))
* **nutrition:** port the gauge dial to the remaining surfaces ([483908d](https://github.com/VoMinhKhoii/Kallo/commit/483908d5b875dc39fe719d6e71418ce2d8a99b00))
* **nutrition:** require 85% of the calorie target for a fully logged day ([f4fec7e](https://github.com/VoMinhKhoii/Kallo/commit/f4fec7e832af1d61caf5ee667642cbc2b09052e8))
* **nutrition:** require 85% of the calorie target for a fully logged day ([b8008df](https://github.com/VoMinhKhoii/Kallo/commit/b8008df2b2bb07eb6ffc3e31155139fe737f2d7f))
* **prompts:** deep composed-dish decomposition examples (vi + global) ([091ca8e](https://github.com/VoMinhKhoii/Kallo/commit/091ca8ea65aef5119a929ca4e3e18d00c4d91d63))
* **prompts:** locale-block prompt split (vi/global) + locale-aware eval harness ([68bb65d](https://github.com/VoMinhKhoii/Kallo/commit/68bb65db78137437007f62d1b3b0e109b530b6b8))
* **prompts:** split V2 prompts into base + vi/global locale blocks ([a25b84d](https://github.com/VoMinhKhoii/Kallo/commit/a25b84ded5182ca363773a165e65037ddb05827b))
* **prompts:** teach ingredient-level decomposition with deep composed-dish examples ([b36e8a7](https://github.com/VoMinhKhoii/Kallo/commit/b36e8a73c2f40832d4f6a8c76517ea52c8d071bb))
* **push:** FCM pipeline, device token API and producer fan-out ([3e1655a](https://github.com/VoMinhKhoii/Kallo/commit/3e1655aef4ba4f032ebd3bc20ac9f5c1ceda05bc))
* **seo:** make kallo.fit legible to AI agents ([1a23669](https://github.com/VoMinhKhoii/Kallo/commit/1a236692aba210860acf4705dcd7b32eab9fde60))
* **seo:** make kallo.fit legible to AI agents ([48bd241](https://github.com/VoMinhKhoii/Kallo/commit/48bd241ec223ce84cdbb5e9f813038ea3a0745e2))


### Bug Fixes

* address Codex adversarial review findings on the stack ([cd37bb1](https://github.com/VoMinhKhoii/Kallo/commit/cd37bb1a48084c14080f5cd975fe9d5521b2130e))
* **auth:** return JSON from email hook ([2e9f71b](https://github.com/VoMinhKhoii/Kallo/commit/2e9f71b063402da81c5bd3fe0802168bd815af7a))
* **auth:** return JSON from email hook ([e846faa](https://github.com/VoMinhKhoii/Kallo/commit/e846faa7a50e901482fb407ddedd0dc7692a7ad1))
* **billing:** keep the OG card readable and invalidate on trial expiry ([63c963a](https://github.com/VoMinhKhoii/Kallo/commit/63c963a8a68d5aed49cb4ad2c044d15e33125efe))
* **chat:** re-verify sender membership under the group lock before sending ([59af09c](https://github.com/VoMinhKhoii/Kallo/commit/59af09ccb2b4ad2f71b7c7db43ba17f4f285b44b))
* **dashboard:** give the Today card its own height budget ([d487a3d](https://github.com/VoMinhKhoii/Kallo/commit/d487a3d93d4884c616dd1a326755e3efee8eae26))
* **dashboard:** give the Today card its own height budget ([8494969](https://github.com/VoMinhKhoii/Kallo/commit/84949695b65e5c5d8420d670d326479f3b27befb))
* **db:** audit remediations — reap grants, retention cron, meals check ([ed2b8a9](https://github.com/VoMinhKhoii/Kallo/commit/ed2b8a93fd1b0ba9d489088d3b6673c32884c693))
* **db:** harden audit migrations per adversarial review ([cfc3812](https://github.com/VoMinhKhoii/Kallo/commit/cfc38129b54348f2b9cc449a8cfb67227593432c))
* **db:** make audit migrations standalone-valid on main ([1d11531](https://github.com/VoMinhKhoii/Kallo/commit/1d115316b9814edc7b2acb181de95fbb24b8094e))
* **db:** move the data-plane migration past main's newest timestamp ([a7532bb](https://github.com/VoMinhKhoii/Kallo/commit/a7532bb62d12ce26448f804c95e73ea6979ca1c8))
* **db:** override global PUBLIC EXECUTE default for future functions ([5a6381d](https://github.com/VoMinhKhoii/Kallo/commit/5a6381d290e3fbc462768d70041a84dfb0a26138))
* **db:** prod audit remediations — reap grants, retention cron, meals check ([90b480e](https://github.com/VoMinhKhoii/Kallo/commit/90b480e51e97c3ade2b49914680a5c4be873477f))
* **db:** prod audit remediations — reap grants, retention cron, meals check ([ff37ecb](https://github.com/VoMinhKhoii/Kallo/commit/ff37ecbc67fda490056829f62e352443b842b8ef))
* **db:** rename cron loop variable shadowing cron.job ([18d761b](https://github.com/VoMinhKhoii/Kallo/commit/18d761baba8858c09dab08dfd4959a3f43d0d1d3))
* **eval,matching:** vessel check tolerates deep decomposition; tôm sú/thẻ aliases ([0835574](https://github.com/VoMinhKhoii/Kallo/commit/0835574d9554a46476d7eca8267604a2ee219103))
* **eval:** derive per-fixture user context from locale tags ([17ab7ee](https://github.com/VoMinhKhoii/Kallo/commit/17ab7eeafd06e5d9321c6d0c70d779186a4d493b))
* **gauge:** let the logging dial say what the dashboard dial says ([9f660dc](https://github.com/VoMinhKhoii/Kallo/commit/9f660dcba8f513ecf5a2019c896183fc24964505))
* **gauge:** pick the dial's wording by fit, not by radius ([b96a502](https://github.com/VoMinhKhoii/Kallo/commit/b96a5022fd39dd56ffbfefe4da55b8c20cd13661))
* **gauge:** pick the dial's wording by fit, not by radius ([f65d9f4](https://github.com/VoMinhKhoii/Kallo/commit/f65d9f404f416dd01b8b0b5aab2beacc3fa3c933))
* **logging:** stop the feed collapsing to zero width ([50e33c8](https://github.com/VoMinhKhoii/Kallo/commit/50e33c80e540d96d4c6f8469df71379ca06e74c4))
* **matching:** alias 'carne asada' to the broiled flank-steak row ([06494c7](https://github.com/VoMinhKhoii/Kallo/commit/06494c7ebeb2eb7b13f35dd9abf43499de09641b))
* **matching:** alias 'carne asada' to the broiled flank-steak row ([172d409](https://github.com/VoMinhKhoii/Kallo/commit/172d409dcb817e054c2f5b1b5522ef13e56e4d77))
* **matching:** break similarity-saturation ties and show Call 2 the English row name ([5dfd1ee](https://github.com/VoMinhKhoii/Kallo/commit/5dfd1eed1976886aca5b163ca20c6b4a56837f61))
* **matching:** similarity-saturation tie-break + English row names for Call 2 ([1bb5530](https://github.com/VoMinhKhoii/Kallo/commit/1bb55301f3c3d4fd5d3a75863774845e6c583cb7))
* **mobile-settings:** tighten the settings index and fix four defects ([693562c](https://github.com/VoMinhKhoii/Kallo/commit/693562cc9eaa0e0e74320b435ea7649cb56af55b))
* **mobile:** define common.remove, which nothing did ([e4e4e7c](https://github.com/VoMinhKhoii/Kallo/commit/e4e4e7c7d129011dc2febb79b6caa45ee43b8a21))
* **mobile:** four logging and shell UI fixes ([6434a3d](https://github.com/VoMinhKhoii/Kallo/commit/6434a3d6c33d6bc0d8ecb946c53771ade27ed4c2))
* **mobile:** give the chat bubble the iOS system context menu ([abcf777](https://github.com/VoMinhKhoii/Kallo/commit/abcf777ae970ffd4433161368686cb7dff82994d))
* **mobile:** make the swipe-to-delete reveal read as one shape ([8602934](https://github.com/VoMinhKhoii/Kallo/commit/8602934f93942ae30277e14bfe638bc084b93b67))
* **mobile:** match the confirm dialog's buttons to the rest of the app ([8a73f20](https://github.com/VoMinhKhoii/Kallo/commit/8a73f201153ec9a99aaf74b275de6a919d0ba41b))
* **mobile:** open the sidebar with a swipe from anywhere ([88bf22f](https://github.com/VoMinhKhoii/Kallo/commit/88bf22f31d5f60950e1060abf98f2e2eac3bb21d))
* **mobile:** repair two defects the perf refactor introduced ([fe4a0bc](https://github.com/VoMinhKhoii/Kallo/commit/fe4a0bca58b811459507d9eced698f044e271d16))
* **mobile:** stop the logging feed collapsing to zero width ([a8f5629](https://github.com/VoMinhKhoii/Kallo/commit/a8f56292a40c1273e5f6cdfd228bb6fa649dd16b))
* **mobile:** travel the newest turn to the top on send ([420ed60](https://github.com/VoMinhKhoii/Kallo/commit/420ed601317daf29b0be754e27ffd1c7d613c845))
* **mobile:** widen macro labels and unify the confirm dialog ([f6fb1b7](https://github.com/VoMinhKhoii/Kallo/commit/f6fb1b727801a21ce6a8059b6585b604ebaaa5ef))
* **notifications:** atomic chat audience capture and server-side invite close ([792dbc9](https://github.com/VoMinhKhoii/Kallo/commit/792dbc9ee22f1cee5aa33445be557ef1b87eb7ca))
* **notifications:** e2e defect fixes — mark-seen precision, plural copy, visibility 500 ([b6babd2](https://github.com/VoMinhKhoii/Kallo/commit/b6babd2e007244d46330481930ff0cee6087be2a))
* **notifications:** exact aggregate membership, push once per open aggregate, neutral invite chip ([d6379f2](https://github.com/VoMinhKhoii/Kallo/commit/d6379f2ea23a12b7bcbc32a1604596784ecb70fb))
* **notifications:** first-mount feed healing and deterministic lock order ([f7dc646](https://github.com/VoMinhKhoii/Kallo/commit/f7dc646ddc4bc6cc52a0f2bdb74a51bd51c459e8))
* **notifications:** FOR UPDATE re-badge classification and activity watermark badge ([e38b502](https://github.com/VoMinhKhoii/Kallo/commit/e38b5026ab295dfcf5a4f0e2f4a01f1fb22af1e3))
* **notifications:** push on insert or seen-to-unseen re-badge; badge poll invalidates feed ([574c54d](https://github.com/VoMinhKhoii/Kallo/commit/574c54d6232470cea86c4e1598402e4416324d69))
* **notifications:** re-gate reply fan-out on live visibility; text-safe notify.ts ([695a3c4](https://github.com/VoMinhKhoii/Kallo/commit/695a3c4f702f1d066970f004d0bca2d50338b851))
* **notifications:** stage-2 implementation review fixes ([44aa378](https://github.com/VoMinhKhoii/Kallo/commit/44aa3789c24bfe18578216d62d23d5a9bceefc84))
* **nutrition:** scope all micronutrients by bucket ([565b54a](https://github.com/VoMinhKhoii/Kallo/commit/565b54a9b18a6eb7738e80d5df5fc31226a82818))
* **nutrition:** scope all micronutrients by bucket ([ebc6d16](https://github.com/VoMinhKhoii/Kallo/commit/ebc6d161c7f1955bf8de11eea620ee9811b6a2c7))
* **seo:** align canonical language signals ([c8d61d2](https://github.com/VoMinhKhoii/Kallo/commit/c8d61d223b8bcad2c04d3f01bd6e22c448ba2a0a))
* **seo:** align canonical language signals ([09b94c6](https://github.com/VoMinhKhoii/Kallo/commit/09b94c6cd13f09fe422b819c3c8b4860cd33994a))


### Performance

* **mobile:** stop the drawer and date picker rebuilding as they animate ([3a86cb6](https://github.com/VoMinhKhoii/Kallo/commit/3a86cb606a3cfa472e87e7faf9f6fd2403347f67))


### Refactor

* **gauge:** give the dials one owner per concept ([bdf1827](https://github.com/VoMinhKhoii/Kallo/commit/bdf182715632288b4fbe9c996dce44806029f5b0))
* **gauge:** split the strip along its own seams ([2bb3a16](https://github.com/VoMinhKhoii/Kallo/commit/2bb3a164d2895adb04c1bd3e1054328c597ec087))
* **legal-links:** open privacy and terms in an in-app browser ([952686d](https://github.com/VoMinhKhoii/Kallo/commit/952686dbf88eaf3053a4ac6c5db5c9409797d94e))
* **mobile:** address thermo-nuclear review findings ([c722528](https://github.com/VoMinhKhoii/Kallo/commit/c722528f14308726594fa52f9be4722fd2684e30))
* **mobile:** split the week strip's chevron into its own file ([0b86786](https://github.com/VoMinhKhoii/Kallo/commit/0b867863721f1caad99550205c1174653ef48743))
* **notifications:** atomic rebadge classification via upsert-set column ([905a642](https://github.com/VoMinhKhoii/Kallo/commit/905a64276c182436f401ae4b80e345c97d82b0ca))
* **notifications:** quality-review cleanups — producer helper, single catalogues ([a1320d1](https://github.com/VoMinhKhoii/Kallo/commit/a1320d15e63690de92e4393e6bf09f96e08c00dd))


### Documentation

* notification system technical design ([5370400](https://github.com/VoMinhKhoii/Kallo/commit/537040086e378092907298d56b69396c7eee6798))
* **notifications:** record accepted in-flight unfriend delivery limitation ([2c3b680](https://github.com/VoMinhKhoii/Kallo/commit/2c3b680cd4d6f1b406d48fe9d308530a24bb06eb))

## [1.12.0](https://github.com/VoMinhKhoii/Kallo/compare/v1.11.0...v1.12.0) (2026-08-22)


### Features

* **barcode:** resolve barcodes through a multi-provider chain (OFF + USDA FDC) ([2dc4a13](https://github.com/VoMinhKhoii/Kallo/commit/2dc4a13becae2d5b112cfb06b4f402d1e3619397))
* **circle:** centre each macro figure under its slice of the bar ([30ff1f5](https://github.com/VoMinhKhoii/Kallo/commit/30ff1f52ff6e6edc13c8065ba1b9d6343593eb1e))
* **circle:** rebuild the feed's hierarchy, rhythm and action row ([c065d5a](https://github.com/VoMinhKhoii/Kallo/commit/c065d5a9acb20df9208ff2e7d247e47150254c39))
* **circle:** rebuild the feed's hierarchy, rhythm and action row ([1156b91](https://github.com/VoMinhKhoii/Kallo/commit/1156b911bee0bf184d5f729366d6f858403e10f5))
* **circle:** show the logged clock time, not an elapsed span ([3922cab](https://github.com/VoMinhKhoii/Kallo/commit/3922cabf8e21d17ab46a44cab795236a6c0b54e7))
* **dashboard:** rebuild the dock around a 240° gauge dial ([4e6de7f](https://github.com/VoMinhKhoii/Kallo/commit/4e6de7f83486e9be96e40db7fb696589eb3b7b11))
* **dashboard:** rebuild the dock around a 240° gauge dial ([621793a](https://github.com/VoMinhKhoii/Kallo/commit/621793a7eaabcb18dd73bcbc7c89709ea5387d3b))
* **lib:** dissolve the lib/ root into concern folders ([35b2cbb](https://github.com/VoMinhKhoii/Kallo/commit/35b2cbbbc6f23968e0f663efddfaf240ddaf5b5d))
* light the meal composer, and give web the empty-day question ([71912f4](https://github.com/VoMinhKhoii/Kallo/commit/71912f4de24c8757eb5bd2831262294ffacd8807))
* **logging:** finalize nutrition label ocr pipeline with micronutrient support ([f734c7d](https://github.com/VoMinhKhoii/Kallo/commit/f734c7da1b6caa9b51eb6dcf5848839503ecc944))
* **logging:** streaming ticker on both platforms, lit composer, first-paint layout ([12926c6](https://github.com/VoMinhKhoii/Kallo/commit/12926c69e3031e480c0f9ef31742c2100f0dccdb))
* **nutrition-ocr:** expand micronutrients extraction and upgrade vis… ([27ec63b](https://github.com/VoMinhKhoii/Kallo/commit/27ec63bf59a1b7c0fc7b690f6c699fbb59733302))
* **nutrition-ocr:** expand micronutrients extraction and upgrade vision model ([2f46f64](https://github.com/VoMinhKhoii/Kallo/commit/2f46f6409befa16e2521b73435b2ebd91f622464))
* **scan:** read a nutrition label on mobile, and unify the scan surfaces ([fbba8a3](https://github.com/VoMinhKhoii/Kallo/commit/fbba8a35336830436f69227ff2b4fa3407a5da8a))
* **scan:** read a nutrition label on mobile, and unify the scan surfaces ([4dc8875](https://github.com/VoMinhKhoii/Kallo/commit/4dc8875d62d6cd7b1e9d85fdd03b118a6cbf7c2f))
* **seo:** make the site discoverable, and stop describing it as Vietnamese-only ([a9344a1](https://github.com/VoMinhKhoii/Kallo/commit/a9344a1fc12de5d64648d25b8c919269ff4cb959))
* **seo:** name the category "nutrition tracker", not meal or calories ([a4ab128](https://github.com/VoMinhKhoii/Kallo/commit/a4ab128c537494e4315ccad389dda3952aa64b5c))
* **seo:** put the hook in the title, and stop pages dropping their og:image ([c881307](https://github.com/VoMinhKhoii/Kallo/commit/c881307d1deeb1314696de9712eed825a39b9bc5))
* **seo:** put the hook in the title, and stop pages dropping their og:image ([920d826](https://github.com/VoMinhKhoii/Kallo/commit/920d82608e2b64221dba37cc54b9232fbdf689a7))
* **seo:** reposition the en metadata from Vietnamese-only to global ([1c529b6](https://github.com/VoMinhKhoii/Kallo/commit/1c529b63c55de152c86b1cbba10138f6533e6fe3))
* **web:** let the server say where the composer goes ([ef65c1b](https://github.com/VoMinhKhoii/Kallo/commit/ef65c1bd0afa234d10dba99f1e515e5df30d8299))


### Bug Fixes

* address adversarial review findings ([447672c](https://github.com/VoMinhKhoii/Kallo/commit/447672c109bfb01a5b9b82f66c7e6e8921b77f01))
* **ai:** stop counting bone weight as meat in grounded estimation ([3841a57](https://github.com/VoMinhKhoii/Kallo/commit/3841a5784d12f7bc5d7479ba929fd56a64535979))
* **ai:** stop counting bone weight as meat in grounded estimation ([d4579a5](https://github.com/VoMinhKhoii/Kallo/commit/d4579a5c573a74af2d48b23dc73ccf80f56ae223))
* **biome:** organize imports/exports in lib/ai/gemini.ts ([147cb10](https://github.com/VoMinhKhoii/Kallo/commit/147cb10322a6448323e6ad4e1586fd7c6d396b36))
* **circle:** bar to 6pt, macro figures to ink ([ad5ece6](https://github.com/VoMinhKhoii/Kallo/commit/ad5ece66b7c47b7fc8b50740a4d7a5b3bff3a5c4))
* **circle:** one rule per day boundary, bold the author name ([1e82f25](https://github.com/VoMinhKhoii/Kallo/commit/1e82f255c7ca79b799b18aeea12efc8c3d171de7))
* **circle:** take the weight back out of the feed's nutrition block ([8847e40](https://github.com/VoMinhKhoii/Kallo/commit/8847e4019353b738c3a33f175f9036e9b855d9e5))
* **ci:** refactor barcode scanner dialog under 200 lines threshold ([871d2b2](https://github.com/VoMinhKhoii/Kallo/commit/871d2b2a344247de391d1a8e4623d1fa93dcb38d))
* **ci:** resolve tsc build errors and test import paths for label ocr ([62dff72](https://github.com/VoMinhKhoii/Kallo/commit/62dff72002e47221ae7eba76ea3daeaa162c814f))
* land the composer where it belongs instead of flying it there ([6e7df77](https://github.com/VoMinhKhoii/Kallo/commit/6e7df77f3a92231dd624db445ed6d3734e796ee0))
* **logging:** optimize barcode scanner framerate, format filter, and scan bounds ([2769cf4](https://github.com/VoMinhKhoii/Kallo/commit/2769cf477d81a0b597a20e16927784b3264555cf))
* **mobile:** keep the auth session stream alive across gotrue errors ([0a0ff04](https://github.com/VoMinhKhoii/Kallo/commit/0a0ff04c0363ef4a5f3f5a5322d976d9533e834a))
* **mobile:** keep the auth session stream alive across gotrue errors ([93199da](https://github.com/VoMinhKhoii/Kallo/commit/93199daa0abf1a9fff18d9fa01a86caadb74f1d4))
* **mobile:** keep the composer halo off the meal cards ([428316b](https://github.com/VoMinhKhoii/Kallo/commit/428316b375a15156a2fe8ce4585468d363cb93e5))
* **nutrition:** stop the composition bar collapsing to zero width ([c3e8b67](https://github.com/VoMinhKhoii/Kallo/commit/c3e8b6792895562dc57bd67d813468e321687b22))
* **nutrition:** stretch the composition bar's segments to the bar height ([0e66e99](https://github.com/VoMinhKhoii/Kallo/commit/0e66e99dbdaa695cbaa1bb5cf7c76254287b521c))
* **ocr:** address CodeRabbit logic findings on the hardening PR ([7d10b59](https://github.com/VoMinhKhoii/Kallo/commit/7d10b59f387a52545465369dcf0ac9c451010c39))
* **ocr:** address CodeRabbit UI and lifecycle findings ([b202d30](https://github.com/VoMinhKhoii/Kallo/commit/b202d307ec215931033346992cb5ec1f0b51b33d))
* **ocr:** fix seam-test CI flake and restore Flutter barcode scan window ([846bfdb](https://github.com/VoMinhKhoii/Kallo/commit/846bfdb00fc73e3c456b59f9ece39523a30bfb1f))
* **ocr:** harden nutrition label OCR data flow and execution lifecycle ([bc450db](https://github.com/VoMinhKhoii/Kallo/commit/bc450db4011d028caee6b18f4639385909fe3b1d))
* **ocr:** read thousands groups as thousands, not decimals ([d1b2fbf](https://github.com/VoMinhKhoii/Kallo/commit/d1b2fbf93350828324fbb5385d9a83b2fe8b5d08))
* **ocr:** stop advertising server-side HEIF, pluralize serving label ([ed78138](https://github.com/VoMinhKhoii/Kallo/commit/ed78138a1c6de253eade7ca0372fef7f77888dfb))
* **security:** sanitize previewUrl in ocr-scanner-tab to resolve CodeQL alert ([eed29cb](https://github.com/VoMinhKhoii/Kallo/commit/eed29cb712bc34dbedd943d0e7bec121617a9050))
* **security:** stop emitting a CSP directive that report-only ignores ([8aed570](https://github.com/VoMinhKhoii/Kallo/commit/8aed570728dbea7b909db98d7b569d0266faba83))
* **security:** stop emitting a CSP directive that report-only ignores ([04bc627](https://github.com/VoMinhKhoii/Kallo/commit/04bc6278f5edee3f0cabd84ced9afc8666074acf))
* **seo:** drop the hook from the Vietnamese title ([0cc3334](https://github.com/VoMinhKhoii/Kallo/commit/0cc3334aba85c8d43dc14d8b1f827ba6ae0d44b1))
* **seo:** restore "Trình theo dõi" to the Vietnamese title ([f368933](https://github.com/VoMinhKhoii/Kallo/commit/f3689339210c2fabd22acbe1f676d81704a487d0))
* **seo:** reword the Vietnamese title ([c44dca5](https://github.com/VoMinhKhoii/Kallo/commit/c44dca525fbcfefdf77e10762d5e5b656a558479))
* **test:** use direct wikimedia image URL with browser User-Agent in label-ocr live test ([11cade3](https://github.com/VoMinhKhoii/Kallo/commit/11cade3a4d5e2d75eee7c323aa211ddf53b9e91b))
* **web:** stop the halo being cut off by its own box, and stage its entrance ([5163836](https://github.com/VoMinhKhoii/Kallo/commit/5163836cc5ccaadddba483583a6d9760bb68d22f))


### Refactor

* **ai:** decompose the meal pipeline into named concern folders ([15cb62b](https://github.com/VoMinhKhoii/Kallo/commit/15cb62b300f67db983f9c907222e23be6fd95044))
* **ai:** extract gemini-provider module to satisfy file size limit ([3d27e85](https://github.com/VoMinhKhoii/Kallo/commit/3d27e8590cc3a65355892c900eba67ac3514b62a))
* **ai:** make the gross+refuse schema permanent, not a toggle ([3bd8013](https://github.com/VoMinhKhoii/Kallo/commit/3bd8013e805eb249404a568dc51ebd4448f739bc))
* **ai:** restructure the rest of lib/ai into concern folders ([43e29ea](https://github.com/VoMinhKhoii/Kallo/commit/43e29eae39e3bc976d214185123da94a2a144059))
* **app:** thin the fat route handlers and lift admin out of the route tree ([21c8488](https://github.com/VoMinhKhoii/Kallo/commit/21c84883ba82eb9a4a6404aade93f1f32a7e4d72))
* **circle:** split the feed widgets under the 200-line gate ([1afa874](https://github.com/VoMinhKhoii/Kallo/commit/1afa8747f64cbc50c9e3145ba8fb80767409752c))
* **components,hooks:** break the layering inversion and split the over-cap folders ([3b9d7b4](https://github.com/VoMinhKhoii/Kallo/commit/3b9d7b431535d1ca1106f33a63a9113f26dec9dd))
* **dashboard:** give the dial one owner and close the feature boundary ([a2e4f73](https://github.com/VoMinhKhoii/Kallo/commit/a2e4f7349dc742c95b832b81c9a4ea79d2ffd7cd))
* fix what the quality review found in this branch ([a0d0a92](https://github.com/VoMinhKhoii/Kallo/commit/a0d0a925b8face699ffca1cd8858094ebda6a5aa))
* **lib:** group lib/ by function — 38 top-level entries down to 12 ([0fc7a77](https://github.com/VoMinhKhoii/Kallo/commit/0fc7a77fe62d5d31aaa594b7a412f9f60700cc28))
* **lib:** merge billing, split actions, onboarding, admin and contracts ([8d9d8f7](https://github.com/VoMinhKhoii/Kallo/commit/8d9d8f72718168e43e7e3f51d7d8de0fee9de698))
* **lib:** merge groups and chat-groups into lib/social ([cf7cb5a](https://github.com/VoMinhKhoii/Kallo/commit/cf7cb5a4deb157ec37cfa27e3d595b64cf10d08b))
* **mobile:** drop the redundant session fallback and duplicate observer ([7beffdc](https://github.com/VoMinhKhoii/Kallo/commit/7beffdc4fd8b554e832a57075c066cc8120ae331))
* **mobile:** restructure the Flutter tree ([4f260f6](https://github.com/VoMinhKhoii/Kallo/commit/4f260f651347829f2f3fe2b6f795832d3ae996cb))
* **scan:** one field widget, and a folder that can be scanned ([5127394](https://github.com/VoMinhKhoii/Kallo/commit/512739424a340269f893d06b0476c13a46bb0c47))
* **scan:** rebuild the label review as a readout, not a form ([a2701b0](https://github.com/VoMinhKhoii/Kallo/commit/a2701b0b3f01025e9bc427de8aeb2307b51f69ea))
* **scripts,i18n:** reorganise scripts and split the message catalogues ([8626dac](https://github.com/VoMinhKhoii/Kallo/commit/8626dac8d5edd8d087ad82c00c2c8a2f1c5dc82f))
* **theme:** one macro palette app-wide ([34e9007](https://github.com/VoMinhKhoii/Kallo/commit/34e900766f02d0b30f3965004af7260cfd444f42))
* **ui:** drop the lines that only restated the title ([c10e797](https://github.com/VoMinhKhoii/Kallo/commit/c10e7977ee39c60f695b4a379e2ab6ea2a1295c5))
* **ui:** extract OcrModeToggle to satisfy component file size limit ([3d31659](https://github.com/VoMinhKhoii/Kallo/commit/3d31659f3f07cdd22386155ccd0071928f98709b))

## [1.11.0](https://github.com/VoMinhKhoii/Kallo/compare/v1.10.0...v1.11.0) (2026-08-13)


### Features

* **ai:** define the edible/gross mass basis and derive it from refusePct ([7abc5ee](https://github.com/VoMinhKhoii/Kallo/commit/7abc5ee34e67f7efc6af6cf0aad5e253b60eab79))
* **auth:** mint Google ID tokens on our own origin for web sign-in ([4a45180](https://github.com/VoMinhKhoii/Kallo/commit/4a45180a406b30294db14d4b2768e0c4633c8c79))
* **auth:** show Kallo on the Google consent screen for web sign-in ([5dc21df](https://github.com/VoMinhKhoii/Kallo/commit/5dc21df3650c7dc35344dda0ae6f52e2660a2264))
* **billing:** add Paddle-backed web checkout ([f912a51](https://github.com/VoMinhKhoii/Kallo/commit/f912a512eac19aef2fcac40e3ca2c5369e7db36d))
* **data:** land NIN enrichment migration ([c45cfc3](https://github.com/VoMinhKhoii/Kallo/commit/c45cfc309595b4bfcc0a76cfc8b9dda5e0a1a00e))
* **db:** NIN foods-table enrichment pipeline (additive-only, dev-gated) ([dda1f5d](https://github.com/VoMinhKhoii/Kallo/commit/dda1f5d334c18dd4fe08dc3f8fba3ad687d0ecd6))
* **db:** NIN foods-table enrichment pipeline (additive-only) ([0004ba2](https://github.com/VoMinhKhoii/Kallo/commit/0004ba28f57e1db8524aa359a105bcc563fa6d9a))
* **landing:** open signup and point the waitlist at the mobile launch ([3579013](https://github.com/VoMinhKhoii/Kallo/commit/3579013d3726c2632a17d2ba399fa58a11bde83a))
* **nutrition:** 7d/30d/90d ranges, column selection, and a scope toggle that greys instead of moving ([cc1c8a3](https://github.com/VoMinhKhoii/Kallo/commit/cc1c8a32a952f4bbc6903386aa320ea9059dcccc))
* **nutrition:** compare the calorie figure against the previous period ([d6b2645](https://github.com/VoMinhKhoii/Kallo/commit/d6b26454365dfe700a5ef8461ad62ad1d5992eed))
* **nutrition:** food icons for the macro legend, one line again ([b722435](https://github.com/VoMinhKhoii/Kallo/commit/b72243539539f414755dbbf6a40489869bf137f0))
* **nutrition:** localized macro legend labels, evenly spaced ([ce25ac0](https://github.com/VoMinhKhoii/Kallo/commit/ce25ac0e6294d06ea4167e1c3333c8c239d0a199))
* **nutrition:** name the scope switch, day-first dates, shared empty state ([61ba15d](https://github.com/VoMinhKhoii/Kallo/commit/61ba15d4d88616c84a3e28ed71109f4dcad5795e))
* **nutrition:** offer 7d/30d/90d, brighten the chart, fix scope drift ([8187621](https://github.com/VoMinhKhoii/Kallo/commit/8187621b46db8179f7ab8d21a31b53b44f49384e))
* **nutrition:** selection re-scopes the page, yellow fat, zeroed empty state ([5f58ec5](https://github.com/VoMinhKhoii/Kallo/commit/5f58ec551163fdfcc63e6881d9339796a4dda19b))
* **nutrition:** yellow fat band, calendar week, tap a column for its micros ([c0cda17](https://github.com/VoMinhKhoii/Kallo/commit/c0cda175c13e1723388b2fded7973b9d5899d046))


### Bug Fixes

* **ai:** address CodeRabbit full-review findings on the refuse path ([dbd432f](https://github.com/VoMinhKhoii/Kallo/commit/dbd432f31694b1e5c09ef72a08ed281c26414df8))
* **ai:** address timeout review feedback ([85e82d8](https://github.com/VoMinhKhoii/Kallo/commit/85e82d81b9b8c869c94f63786d1d5f45405a1168))
* **ai:** bound cold matching before Call 2 ([d8780ae](https://github.com/VoMinhKhoii/Kallo/commit/d8780ae44df410e7a392d50e7f2c67b248cc7572))
* **ai:** bound cold matching before Call 2 ([384cc8a](https://github.com/VoMinhKhoii/Kallo/commit/384cc8a0dfeadc9917711dcb4f13a679887220ff))
* **ai:** harden refuse classification against fold collisions ([883fa72](https://github.com/VoMinhKhoii/Kallo/commit/883fa72614dd07d5892a096a62bb37f9fe852f03))
* **ai:** map flushed macros by meal identity ([f57cf1a](https://github.com/VoMinhKhoii/Kallo/commit/f57cf1ac01dda953113571dd172e8a35b2a8e33d))
* **ai:** map flushed macros by meal identity ([f3f2663](https://github.com/VoMinhKhoii/Kallo/commit/f3f26635d9418320ef5501df65a7cb128b59bafd))
* **ai:** stop saturated lexical scores deciding candidate order ([da88be7](https://github.com/VoMinhKhoii/Kallo/commit/da88be7052854a63f0ce1b70541d68b6ebc824d1))
* **auth:** clear the Google button when the ID token exchange throws ([020fb59](https://github.com/VoMinhKhoii/Kallo/commit/020fb59ace487884fb30107286f7e65d9e462941))
* **auth:** say why Google sign-in fell back to the redirect flow ([cd475c3](https://github.com/VoMinhKhoii/Kallo/commit/cd475c3c33eb5afcc1c11d60be8147ee8c36b0f4))
* **auth:** treat a blank GOOGLE_WEB_CLIENT_ID as unconfigured ([b33dc83](https://github.com/VoMinhKhoii/Kallo/commit/b33dc839ac8cb2f7272e87956117aaf62c77c52b))
* **billing:** correct the Terms' deletion promise and stop offering web lifetime ([133412d](https://github.com/VoMinhKhoii/Kallo/commit/133412d6190b755680c0b3ee903cc9d89b18e5ea))
* **billing:** keep the deferred-plan filter out of the error log ([014ac81](https://github.com/VoMinhKhoii/Kallo/commit/014ac814f1d666087b3ef511745f447b69dc8ddc))
* **billing:** stop a superseded poll caching a stale entitlement snapshot ([4c82b32](https://github.com/VoMinhKhoii/Kallo/commit/4c82b3221c8e6e2614ca289ba5cbaf81fa6a69af))
* **data:** address CodeRabbit findings — row-identity clone dedupe, stricter schemas ([0b995a6](https://github.com/VoMinhKhoii/Kallo/commit/0b995a6f3c64c6b364416f7c4aff020a933b8141))
* **data:** harden NIN enrichment landing ([ca17fc8](https://github.com/VoMinhKhoii/Kallo/commit/ca17fc800588faa06ff87ec87ce3e1c34a086b9a))
* **data:** prepared NIN composites are cooked, not raw ([7ee6254](https://github.com/VoMinhKhoii/Kallo/commit/7ee6254db989bf62e47bf7331bab3cddf6eef67d))
* **data:** review NIN ingestion decisions ([eed32e4](https://github.com/VoMinhKhoii/Kallo/commit/eed32e48bc4d54197650d9d75e70000d405d798d))
* **db:** repair alcohol rows missing ethanol energy ([f245a5f](https://github.com/VoMinhKhoii/Kallo/commit/f245a5f5cd3a88d214dda4740675164263a84b01))
* **landing:** fill the comparison panels, and make a covering card read as depth ([16af251](https://github.com/VoMinhKhoii/Kallo/commit/16af2519378e42791c21965ae5321036707830c6))
* **landing:** let the meal cards fill the panel they sit in ([414833d](https://github.com/VoMinhKhoii/Kallo/commit/414833debc29c3dfd61e02aab5d50cb390f960ac))
* **landing:** make a covering card read as depth, not as a crop ([a25f717](https://github.com/VoMinhKhoii/Kallo/commit/a25f717e3c6855e31182a8bb8ff46ad4886fb89d))
* **nutrition:** a selected column keeps its colour even when the scope drops it ([12430c7](https://github.com/VoMinhKhoii/Kallo/commit/12430c77a5d273ab365941befd79921cd3e4d23e))
* **nutrition:** address CodeRabbit review — selection, a11y, and contracts ([3f3c5d4](https://github.com/VoMinhKhoii/Kallo/commit/3f3c5d4a8373c464949ec91b9e84e917adc3be18))
* **nutrition:** clear the bucket selection when the range changes ([259fced](https://github.com/VoMinhKhoii/Kallo/commit/259fced446592ff9bee63e8135857a771b65f260))
* **nutrition:** grey the set-aside columns instead of dropping them ([3c6689c](https://github.com/VoMinhKhoii/Kallo/commit/3c6689cecfd742f5b7cfa8d18131557331a94b72))
* **nutrition:** keep the trend bars weekly and steady across day scope ([84d9d30](https://github.com/VoMinhKhoii/Kallo/commit/84d9d30ed6cf977834cfc7b3cdd73c8c86471b46))
* **nutrition:** one day set per card, and an axis that fits the data ([ce56d1b](https://github.com/VoMinhKhoii/Kallo/commit/ce56d1b38dcf8f01815a59997db1eb7cafa8f09f))
* **nutrition:** pin the source line, box the empty state, keep data on switch ([6e30a20](https://github.com/VoMinhKhoii/Kallo/commit/6e30a20f33c4bd3b223733f40c8bd0cf87b43216))
* **nutrition:** the scope toggle greys columns, it never moves them ([682e71b](https://github.com/VoMinhKhoii/Kallo/commit/682e71b33e5889cf5cf3b2328d127e418811fb08))
* **portion:** make every declared prior reachable, and add head piece priors ([a43ead6](https://github.com/VoMinhKhoii/Kallo/commit/a43ead6cd36800ae50530b4c6a026242d2b1466f))
* **portion:** stop diacritic folding from routing bún to clarify ([d1267f7](https://github.com/VoMinhKhoii/Kallo/commit/d1267f74c31fa09a83ae1825630bbfdcd2eb5777))
* repair alcohol row energy values ([0ade5b7](https://github.com/VoMinhKhoii/Kallo/commit/0ade5b7edb7af753cede226ddf40a125433d284d))
* **search:** autocomplete route enforces its own similarity floor ([8e5382b](https://github.com/VoMinhKhoii/Kallo/commit/8e5382b4207ec63c15a02fe7baadbd07e5e26f43))
* **search:** rank on the best-matching field, not name_primary ([fbd6f56](https://github.com/VoMinhKhoii/Kallo/commit/fbd6f5633bf859829b33c3c4a201da1571f1bb7b))
* **security:** allow Google Identity Services through the CSP ([a3e2d97](https://github.com/VoMinhKhoii/Kallo/commit/a3e2d97a23fb4dd0cee564c9465ea18c73171748))


### Refactor

* **billing:** split the paywall's purchase machine out of the dialog ([6788aca](https://github.com/VoMinhKhoii/Kallo/commit/6788acae9f56478a35d18619acd913d4b65b8dfe))
* **data:** simplify NIN enrichment modules ([330ebc5](https://github.com/VoMinhKhoii/Kallo/commit/330ebc5893da651753586646eb7b57d644969db2))
* **nutrition:** one zero-state builder, drop a wrapper, fix a layer ([232ea03](https://github.com/VoMinhKhoii/Kallo/commit/232ea03887a1034e58abdd86c80fb17b8de6cfc1))
* **nutrition:** plain kcal, figure back on top, "All" for logged days ([da0d4ca](https://github.com/VoMinhKhoii/Kallo/commit/da0d4cac28a573a6f8b66ed593f7ca1a912c5e2a))
* **nutrition:** switch to the top-right corner, scope named in the title ([0dc9472](https://github.com/VoMinhKhoii/Kallo/commit/0dc9472231c686126d3f8d9904709237e2341ba0))
* **portion:** one folded index for concepts and units ([e8fc71f](https://github.com/VoMinhKhoii/Kallo/commit/e8fc71f9ca5b97a8fcbd2c71492f665479133f28))
* **theme:** adopt #FCFCFC as the app canvas on both platforms ([208a1ef](https://github.com/VoMinhKhoii/Kallo/commit/208a1ef9fda604dd9e50988012e335292b2d4a6e))


### Documentation

* bring the README up to date ([6a87208](https://github.com/VoMinhKhoii/Kallo/commit/6a8720849a8ec34edc3375b1b821b5abc7146435))
* bring the README up to date ([d537ca5](https://github.com/VoMinhKhoii/Kallo/commit/d537ca5e2ffc6a384052240beb1c6ae3af5e4b76))
* bring the README up to date, and keep eval captures out of git ([a29a466](https://github.com/VoMinhKhoii/Kallo/commit/a29a466a9c16e511bb5787a7c4a6562a228afbda))
* bring the README up to date, and keep eval captures out of git ([93ec9bc](https://github.com/VoMinhKhoii/Kallo/commit/93ec9bc71e765870d2ffb783815b9568e7cb82c4))
* **enrich:** record dev-DB validation results ([0b36385](https://github.com/VoMinhKhoii/Kallo/commit/0b36385796495745d78a793fa2c24e0719703e30))
* **enrich:** record end-to-end pipeline validation ([0c3307e](https://github.com/VoMinhKhoii/Kallo/commit/0c3307e8cf2317b0f8fc7a86285ca99e82b09aef))
* **legal:** state an actual refund policy ([ed6e57c](https://github.com/VoMinhKhoii/Kallo/commit/ed6e57c361fd28e19cacad268c1dba93cb6af5b0))
* **legal:** state an actual refund policy, not just who handles refunds ([8b5fba2](https://github.com/VoMinhKhoii/Kallo/commit/8b5fba22551b1772ee0f4495f19f75cfa4447055))

## [1.10.0](https://github.com/VoMinhKhoii/Kallo/compare/v1.9.0...v1.10.0) (2026-08-09)


### Features

* **ai:** explicit-state candidate filter + basis-rule final check ([e4892b1](https://github.com/VoMinhKhoii/Kallo/commit/e4892b1fa6483fe5315fc3d3f290eb22d18454d2))
* **ai:** require every Call-2 macro triple; self-scope the translation pipeline ([222ac15](https://github.com/VoMinhKhoii/Kallo/commit/222ac15e84d1e311cd20c27c2ff5ee5001283123))
* **docs:** bilingual documentation site at /docs ([866794d](https://github.com/VoMinhKhoii/Kallo/commit/866794d6873557d6d69e28ebaf338112b2163a31))
* **docs:** bilingual documentation site at /docs ([1555ed0](https://github.com/VoMinhKhoii/Kallo/commit/1555ed0cc6c40e04d2d6174e1273d97c274064a2))
* **docs:** remove the hub, widen the measure to fit titles on one line ([ccb2055](https://github.com/VoMinhKhoii/Kallo/commit/ccb20550756679cde22aabe8ad0385ccaa026dae))
* **docs:** replace the sidebar with a footer directory ([d66863d](https://github.com/VoMinhKhoii/Kallo/commit/d66863dd2d6417731f4efd9b3e2e1b5da6e89802))
* **email:** dark ("inverse") theme with the cream Kallo wordmark ([92dbc0c](https://github.com/VoMinhKhoii/Kallo/commit/92dbc0c3e89a8f03c4d0d98188ca01898a64bbd3))
* **email:** route all mail through Resend + add hero waitlist ([2aa6591](https://github.com/VoMinhKhoii/Kallo/commit/2aa659167c91c55d27e4f72e04e8d88744d2273b))
* **email:** send all email through Resend and add a hero waitlist ([1d3039f](https://github.com/VoMinhKhoii/Kallo/commit/1d3039f4aa877366a6d822d83c58d5895507c72b))
* **landing:** card-local hover art, waitlist CTA, monochrome type ([2d961b7](https://github.com/VoMinhKhoii/Kallo/commit/2d961b71fa18c11172171ef15e52e6f6edb84701))
* **landing:** dim the paint on espresso, cards back in the fold, mobile art ([96ca4b5](https://github.com/VoMinhKhoii/Kallo/commit/96ca4b5d5165c7f28c0658868b67a19c9a948e59))
* **landing:** hero design lab with switchable compositions ([f5b300a](https://github.com/VoMinhKhoii/Kallo/commit/f5b300aee191478733763d9112bdb615d0d00a1b))
* **landing:** hero design lab, and retire the v3 globe ([bb21894](https://github.com/VoMinhKhoii/Kallo/commit/bb21894300539f7d283c41ad49fe81a3e237daa7))
* **landing:** mirror the app's meal card, docs footer, mobile hero ([d745cb3](https://github.com/VoMinhKhoii/Kallo/commit/d745cb359ee25ec691e5b0685b488b340124a602))
* **landing:** one composition, working header, footer, inverted card art ([1243024](https://github.com/VoMinhKhoii/Kallo/commit/124302492ea304678d75c6c4ea4e635a895e17d7))
* **landing:** rebuild the landing page — hero, proof section, pricing ([#258](https://github.com/VoMinhKhoii/Kallo/issues/258)) ([71d2c00](https://github.com/VoMinhKhoii/Kallo/commit/71d2c001c90be44a9018e9104878826693b41693))
* **landing:** touch detection that works, unstretched cards, full-width grid ([509f9d2](https://github.com/VoMinhKhoii/Kallo/commit/509f9d2b26ce64ec5dd81ef1b1f88836f8c939e2))
* **landing:** waitlist in the meal-input pill, underlined headline ([5309e67](https://github.com/VoMinhKhoii/Kallo/commit/5309e6747c4dc1959a29f08747172c3c7b9725e5))
* **logging:** picked dishes become blue text in the composer ([3645649](https://github.com/VoMinhKhoii/Kallo/commit/36456493856a46fe9fbcc4170debdd9cda7498f1))
* **logging:** relog past dishes and meals from a `/` picker ([5a48363](https://github.com/VoMinhKhoii/Kallo/commit/5a48363c68bbbe78dd4e32601d16fd8fd2433397))
* **logging:** relog past dishes/meals through the editable review card ([b5666a8](https://github.com/VoMinhKhoii/Kallo/commit/b5666a8d10ad2a7102135a52c8f490182a88010a))
* **logging:** route relog picks through the editable review card ([9eef0aa](https://github.com/VoMinhKhoii/Kallo/commit/9eef0aa3b8776e0cea92fa411ba6e17097ef2332))
* **mobile:** port `/` relog to the Flutter composer ([d5707af](https://github.com/VoMinhKhoii/Kallo/commit/d5707afc2ce566cf87f18452d53183477384df8d))
* **mobile:** port `/` relog to the Flutter composer, fix macro readout wrap ([eb77203](https://github.com/VoMinhKhoii/Kallo/commit/eb772036c8df21ebb864fa23c95698f7fdbf9456))
* **mobile:** raise icons to 24, ink settings rows, grey the canvas ([d7c5777](https://github.com/VoMinhKhoii/Kallo/commit/d7c57770bd8dfc6b62fb74daaebd8422acbcd163))
* **mobile:** raise icons to 24, ink settings rows, grey the canvas ([8419683](https://github.com/VoMinhKhoii/Kallo/commit/8419683518729941ffeb96e6213a8f2e72744c9b))
* **portion:** draw the portion slider as a graduated measuring ruler ([dc60abb](https://github.com/VoMinhKhoii/Kallo/commit/dc60abbfaaf74b8b7ef545b62907f24cbc4dcfdd))
* **portion:** make the ruler a tape measure, and label pieces individually ([34b7220](https://github.com/VoMinhKhoii/Kallo/commit/34b722042d6831cfe4dee50681fd006099f90a3f))
* **portion:** port the visual portion clarity picker to Flutter ([7c5e585](https://github.com/VoMinhKhoii/Kallo/commit/7c5e5859c6e743e8d1f3b098f3d0b107d7a59360))
* **portion:** port visual portion clarity to Flutter, as a tape measure ([515762b](https://github.com/VoMinhKhoii/Kallo/commit/515762b010a1d4cf3bb3b326c47c81ea7b8f7293))


### Bug Fixes

* address CodeRabbit review — garbage embeddings, gate denominator, alias hijack ([e0e713e](https://github.com/VoMinhKhoii/Kallo/commit/e0e713e5031c8d0501e6f00e007d42e1ea661dc2))
* address pre-ship review — CI lease env, rerun no-op, materiality gate ([6abe041](https://github.com/VoMinhKhoii/Kallo/commit/6abe041b21013715d93b283e665ea19f034497dd))
* **ai:** close two oil double-count gaps found in review ([de772ea](https://github.com/VoMinhKhoii/Kallo/commit/de772eaaed0ce9beb79608a24288f90d4fad749e))
* **ai:** gate withheld ingredients per-item, not per-meal ([78852f4](https://github.com/VoMinhKhoii/Kallo/commit/78852f49decb291695e8996fc60dcb6fb02efdf6))
* **ai:** make mì gói reachable; stop a dry row reading as a bowl ([d95922b](https://github.com/VoMinhKhoii/Kallo/commit/d95922b8c5bb3ad3382f2b2f3e15f4084a0ad652))
* **ai:** make the fat ceiling bound every displayed bound, and fix two oil misreads ([2572c5a](https://github.com/VoMinhKhoii/Kallo/commit/2572c5a2371dc681e7f9c94f5f17f4ed6965aa6a))
* **ai:** mì-gói zero-candidates incident — required macros, translated USDA, self-scoping pipeline ([5b3f46e](https://github.com/VoMinhKhoii/Kallo/commit/5b3f46e889b0526b091112fae898a4e0f2be58cd))
* **ai:** stop `miến` matching `miếng`, and retire the portion ask-back ([7b8e8af](https://github.com/VoMinhKhoii/Kallo/commit/7b8e8afba68bf61f604e4ea2dc38448bc93423bf))
* **ai:** stop `miến` matching `miếng`, and retire the portion ask-back ([4e0bad9](https://github.com/VoMinhKhoii/Kallo/commit/4e0bad9d3761d6746c34be40928d6dadcd7453b3))
* **ai:** stop the server deleting cooking oil, and fix three matching defects ([621ca16](https://github.com/VoMinhKhoii/Kallo/commit/621ca1611de7e195e379588fab2f71cd7578150d))
* **ai:** stop the server deleting cooking oil, and fix three matching defects ([5be5b65](https://github.com/VoMinhKhoii/Kallo/commit/5be5b65f84cae86f49b292faaf849bb9476d7cd6))
* **ai:** stop unmatched starches shipping 0g carbs; teach the trace v2 ([6ccdcea](https://github.com/VoMinhKhoii/Kallo/commit/6ccdcea8687162f1fc94f4fb84aeecdd7f96d4f7))
* **data:** curate broth search names ([e260377](https://github.com/VoMinhKhoii/Kallo/commit/e2603772d60f5925f2d2791a5d5f527e5ab5a8d9))
* **data:** curate broth search names ([9631745](https://github.com/VoMinhKhoii/Kallo/commit/9631745761cf857d0f268e96019473f7a21465fb))
* **deploy:** make broth curation reset-safe ([f3166bd](https://github.com/VoMinhKhoii/Kallo/commit/f3166bd5e4951e844e5a56b47cfc760e4b650895))
* **deploy:** move embedding completion check into backfill ([d0caaf4](https://github.com/VoMinhKhoii/Kallo/commit/d0caaf43d43834daa9e9ed112b74c8574f5225b2))
* **deploy:** run the embedding backfill on Vertex too ([f49b58a](https://github.com/VoMinhKhoii/Kallo/commit/f49b58a3436da674f08c4f5283b63e8c952b64de))
* **docs:** correct the data-residency claim and act on review findings ([8970940](https://github.com/VoMinhKhoii/Kallo/commit/8970940aa195a44e8e1a7f69de3429750f94d90e))
* **docs:** left-align the pager on one column, enlarge the wordmark ([f600873](https://github.com/VoMinhKhoii/Kallo/commit/f6008732b08e8e2ae7e0e58ecca4739ec455b8f4))
* **eval:** drop scratch files committed by a too-broad git add ([aaa5a76](https://github.com/VoMinhKhoii/Kallo/commit/aaa5a76028049947f3b8051b0314dcba8aea4a89))
* **eval:** stamp fixture provenance with the capture's exact instant ([2f24ed6](https://github.com/VoMinhKhoii/Kallo/commit/2f24ed696fc40077edf1e73d415f692f0f726429))
* **landing,docs:** address actionable CodeRabbit comments ([06cba0c](https://github.com/VoMinhKhoii/Kallo/commit/06cba0c0bce1cd071911f23a78738e6e08038ff7))
* **logging:** align macro cells on the figures, with the label beside them ([2f85cc1](https://github.com/VoMinhKhoii/Kallo/commit/2f85cc19f7d01281c151c2b30a08d8834bbdf84f))
* **logging:** align the meal card's columns, unhide long names, keep word order ([1dd9db7](https://github.com/VoMinhKhoii/Kallo/commit/1dd9db7253ade1379f5cc8ec522d042104e69951))
* **logging:** label a mixed relog meal, and stop the card cutting its numbers ([cca37b9](https://github.com/VoMinhKhoii/Kallo/commit/cca37b9a11d25b47da47f4c55110c334d5dcd15f))
* **logging:** left-align the macro figures so no label is stranded ([450647b](https://github.com/VoMinhKhoii/Kallo/commit/450647bc30e7243856790254c13cba27adce3cb4))
* **logging:** make the confirm button's `disabled` actually disable ([31b82bc](https://github.com/VoMinhKhoii/Kallo/commit/31b82bcfcdcc7ebfd5afcc93d7c0f547d46d405e))
* **logging:** paint the unconfirmed meal card white on the reveal too ([53d3122](https://github.com/VoMinhKhoii/Kallo/commit/53d3122561ffaa327defcedc91d67ee6108bc6ae))
* **logging:** stop the edit-mode meal row hiding every dish name ([be29f36](https://github.com/VoMinhKhoii/Kallo/commit/be29f3674a8bc16b74165ef84842562fd617df6a))
* **logging:** stop the relog write test from touching a real account ([bf826c1](https://github.com/VoMinhKhoii/Kallo/commit/bf826c182138921cf250674b891ebc76379d1928))
* **logging:** stop three-digit macros shrinking, and hold the row still in edit ([a8b9eba](https://github.com/VoMinhKhoii/Kallo/commit/a8b9eba5a7469beab3213fef664453a6a86838df))
* **mobile:** compact logging glyphs, tighter chosen wash, real red ([dca9ac0](https://github.com/VoMinhKhoii/Kallo/commit/dca9ac0bbd8e408e5c3034372d248b9c4a90c6bd))
* **mobile:** danger red clears AA, wash back on the ink layer ([d740134](https://github.com/VoMinhKhoii/Kallo/commit/d740134f37b4fa9907c20634473ac1d3229c0cdf))
* **mobile:** repair call sites left behind by the token moves ([787a040](https://github.com/VoMinhKhoii/Kallo/commit/787a04030c4ed43963754367b344cc5234906037))
* **mobile:** repair relog retry, staged-panel staleness and stage idempotency ([e3b130b](https://github.com/VoMinhKhoii/Kallo/commit/e3b130b57b185f65104522bf4a9912a54886fae5))
* **mobile:** stop the toast inheriting Flutter's yellow underline ([9ffff20](https://github.com/VoMinhKhoii/Kallo/commit/9ffff202d6b7a98d238ec0d8f000d4c969606271))
* **portion:** address review — tier mismatch, needle contrast, count guard ([a796662](https://github.com/VoMinhKhoii/Kallo/commit/a796662841a98fcb05877ad74fefefe5c34bc176))
* **portion:** grill fixes — reachable sheets, operable sliders, exact counts ([b97402c](https://github.com/VoMinhKhoii/Kallo/commit/b97402c18b0a178c38c1ce421745e11c4776b123))
* **portion:** resolve a container word Call 1 put on the ingredient ([e3613e5](https://github.com/VoMinhKhoii/Kallo/commit/e3613e598f597cf532cfb38ce83754fdc0ea1748))
* **portion:** restore the missing vessel silhouettes and fix the ruler's spacing ([2b6b308](https://github.com/VoMinhKhoii/Kallo/commit/2b6b308b34e3b9d3f8e417d047b1ccc360a54254))
* **portion:** ship the 27 vessel silhouettes that were deleted, not converted ([a3611c9](https://github.com/VoMinhKhoii/Kallo/commit/a3611c9b3f112beb1bd2606765204899baa886ee))
* **portion:** stop the ruler silhouettes overlapping and clipping ([075f10d](https://github.com/VoMinhKhoii/Kallo/commit/075f10d0533431aa9965af935fc9c0b29aef6177))
* **portion:** unify the container branch onto the tape ruler ([9480153](https://github.com/VoMinhKhoii/Kallo/commit/94801531701048ff642ff84fc14ed6a1cb49d869))
* **portion:** unify the two unit-token tables, and fold Vietnamese diacritics ([0c8a7f0](https://github.com/VoMinhKhoii/Kallo/commit/0c8a7f08470eef54af84343668b63ce1a268b816))
* **portion:** unify vessel validation across web and mobile ([cfe57ca](https://github.com/VoMinhKhoii/Kallo/commit/cfe57cae9852a4a5caa89f552477664be28a48b5))
* **relog:** bound the relog surfaces and close the remaining data-loss edges ([3d2f764](https://github.com/VoMinhKhoii/Kallo/commit/3d2f7644fef2b68cc958de76ba12d4553c5ffb5c))
* **relog:** clear only what was submitted, and keep one attempt id per selection ([02872e9](https://github.com/VoMinhKhoii/Kallo/commit/02872e9af0442f9b3c1592ef2669dd8d106e242e))
* **relog:** close the phantom token, the retry drift and two clipped cells ([8c36046](https://github.com/VoMinhKhoii/Kallo/commit/8c360464a19d6afa44977b25aa1b11f2c6b5893c))
* **relog:** guard both clients at one boundary, and order mentions where it matters ([0a49fd6](https://github.com/VoMinhKhoii/Kallo/commit/0a49fd68b932554f624a015a6853abba7d4f65ea))
* run both Gemini-calling CI jobs on Vertex, not free-tier keys ([58a3b05](https://github.com/VoMinhKhoii/Kallo/commit/58a3b0568a1fc6dbb766f9f13fc9883e0901bb3d))
* **shell:** stop page scrollers from lifting the whole app ([8c8d89f](https://github.com/VoMinhKhoii/Kallo/commit/8c8d89f08ffb0d2f194e8eb85b5f8a9f8a22a82e))
* **shell:** stop page scrollers from lifting the whole app ([b4091ee](https://github.com/VoMinhKhoii/Kallo/commit/b4091eebc15185403fb79a83c22307076c3bacef))
* **test:** read fatG off IngredientLlmNutrition directly ([1f7da90](https://github.com/VoMinhKhoii/Kallo/commit/1f7da9058e9ea3bec8abe853a00eb6f930728716))
* **test:** stop vitest globbing into .claude worktrees ([0476a00](https://github.com/VoMinhKhoii/Kallo/commit/0476a00c7fe62a1727a1bd761f4ae73dc6aee86a))
* **translate:** address CodeRabbit — key-range drift, cache fallback order ([dea8790](https://github.com/VoMinhKhoii/Kallo/commit/dea87903a295caf97ccb5ceb2de56c95d902ce93))
* **translate:** NULL embeddings in phase 3 so interrupted runs self-heal ([424b1a1](https://github.com/VoMinhKhoii/Kallo/commit/424b1a1f6d984509a48ac084e016c9c666791fde))
* **translate:** release loanword rows from the untranslated predicate ([33f42c8](https://github.com/VoMinhKhoii/Kallo/commit/33f42c8b8b70bd5ba6624e8ded9737bad169c4cf))
* **translate:** run the USDA pipeline on Vertex, not a free-tier key ([cde0e80](https://github.com/VoMinhKhoii/Kallo/commit/cde0e800b4fcbcc7e9a461fd110836ee0beebbd8))
* **translate:** terminate loanwords Gemini refuses to alias ([c7fa839](https://github.com/VoMinhKhoii/Kallo/commit/c7fa83924fdb385f8df0c1bbac6c218eba56805a))
* **translate:** type the NULL name_alt so all-null VALUES chunks stay text[] ([7a7ea56](https://github.com/VoMinhKhoii/Kallo/commit/7a7ea5699006d68d70d8789132ba2d7b84b2fc42))
* **waitlist:** close three concurrency/retry gaps found in review ([751c52b](https://github.com/VoMinhKhoii/Kallo/commit/751c52b78a37923f046b6415b1fe30cf4f1e19d6))


### Performance

* **rate-limit:** bump the three windows in one statement, not three ([e6e9467](https://github.com/VoMinhKhoii/Kallo/commit/e6e9467de8bd97184555b67d4a027f4c1a7b766b))


### Refactor

* **ai:** one supreme basis rule; retire the per-food yield table ([f442e2a](https://github.com/VoMinhKhoii/Kallo/commit/f442e2a76cb3657077391d0b1f1239ae5da0446d))
* **email,landing:** address review findings + brand the emails ([aaf8198](https://github.com/VoMinhKhoii/Kallo/commit/aaf8198ad8faf6f4d584ff00004874554a786922))
* **hero-lab:** drop the dead scroll-warm tone ([5011925](https://github.com/VoMinhKhoii/Kallo/commit/50119252120670595db9b002fd0ca72a0e79a651))
* **hero-lab:** let the tone map own the espresso ground ([01b164d](https://github.com/VoMinhKhoii/Kallo/commit/01b164d20d2ea04df83999a780f790b29493874e))
* **hero-lab:** split the meal card at its details seam ([3c85070](https://github.com/VoMinhKhoii/Kallo/commit/3c85070c381d89a36801d2a29285323e4a005194))
* **landing:** delete the v3 globe lab and its three.js dependency ([ba0d111](https://github.com/VoMinhKhoii/Kallo/commit/ba0d111308dc0d8bad119554a2b0283dd315ed5e))
* **logging:** split meal_entry into one widget per file ([18f1822](https://github.com/VoMinhKhoii/Kallo/commit/18f182298f110de94e7a9fad3f737ade8ca10af7))
* **portion:** drop the pass-through piece layer, nest the ruler ([95a21cb](https://github.com/VoMinhKhoii/Kallo/commit/95a21cb7ef40c6e79a8fb4a73752109752d92ca9))
* **portion:** lift the picker flow out of the meal entry card ([e47dcbb](https://github.com/VoMinhKhoii/Kallo/commit/e47dcbb495edf1f2468014bcdbb246e83ce95a72))
* **portion:** one ruler control for both vessel families ([1106b1b](https://github.com/VoMinhKhoii/Kallo/commit/1106b1b2b0b2e7f272468d7ae04c5291aae09166))


### Documentation

* **en:** use English examples in the English pages ([15dd390](https://github.com/VoMinhKhoii/Kallo/commit/15dd390e422e66008622c45d02681486d332b5c2))
* **legal:** add the jurisdictional sections the policy was missing ([24a6ead](https://github.com/VoMinhKhoii/Kallo/commit/24a6ead5b1ed6a5301d80a6f9ba2889bbee1fe44))
* **legal:** correct data residency to Singapore, not Bangkok ([3408262](https://github.com/VoMinhKhoii/Kallo/commit/3408262b70e1c373c0a5cdf66b4ce2374f9d2e01))
* **legal:** cut the commentary about our own writing ([9b4f224](https://github.com/VoMinhKhoii/Kallo/commit/9b4f224ec3415ab3635c3c7b1c7fdb092f84cf2d))
* **legal:** disclose what Vertex AI does with meal text ([f49aa7b](https://github.com/VoMinhKhoii/Kallo/commit/f49aa7b0478f4e7d83b34162c9c37c40ab6cbdcc))
* **legal:** fill the controller identity and address ([73aba27](https://github.com/VoMinhKhoii/Kallo/commit/73aba277efcbd76dc3052f99d6f8849b53dab6b3))
* **legal:** rewrite the Vietnamese privacy policy as Vietnamese ([ebb34c4](https://github.com/VoMinhKhoii/Kallo/commit/ebb34c4f445ad4a0f6e92088bbf0a407d1867fc6))
* **legal:** say country is self-declared, not device location ([ac884c1](https://github.com/VoMinhKhoii/Kallo/commit/ac884c1359768c88c3be40e0b8475c9f75131159))
* **legal:** set governing law to Vietnam, venue to Ho Chi Minh City ([e0945f5](https://github.com/VoMinhKhoii/Kallo/commit/e0945f5185d080a7d23bb49ee7c8b085434e6941))
* **legal:** stop claiming a backup rotation we don't have ([4634bd4](https://github.com/VoMinhKhoii/Kallo/commit/4634bd49b42ed6ce9184ac16cb27f8f6c434e069))
* **tracking:** rewrite the nutrition page from the code ([637a794](https://github.com/VoMinhKhoii/Kallo/commit/637a794c310eeaa1509b1700b14b93cd408b4669))

## [1.9.0](https://github.com/VoMinhKhoii/Kallo/compare/v1.8.0...v1.9.0) (2026-07-29)


### Features

* **circle:** port Threads-style Circle redesign to Flutter ([2e6943d](https://github.com/VoMinhKhoii/Kallo/commit/2e6943d998dac6586e90ac3ba8aa4af4b0afee9b))
* **circle:** port Threads-style Circle redesign to Flutter ([d2af244](https://github.com/VoMinhKhoii/Kallo/commit/d2af244ce407326cc3541fb6563c9fad46e0ce0c))
* **dashboard,logging:** open a real composer sheet from the FAB, and actually log it ([25f1ff1](https://github.com/VoMinhKhoii/Kallo/commit/25f1ff1cb59035d36909523c8c42fa307d659bdd))
* **dashboard:** supersede on retry; split auto-save into its own hook ([46bbfd2](https://github.com/VoMinhKhoii/Kallo/commit/46bbfd275fd660c8b99e248d2d7e05268d66d99c))
* **design:** neutral Circle palette app-wide — new canvas, ink, hairlines; no gold text ([56bc770](https://github.com/VoMinhKhoii/Kallo/commit/56bc7708fd83f59147c09b4008e49816a63043fc))
* **design:** neutral Circle palette app-wide — no gold text, new canvas ([153010a](https://github.com/VoMinhKhoii/Kallo/commit/153010ab3718a01aa9d7ff4904fe2a80006a47d8))
* harden billing and subscriptions ([2d971db](https://github.com/VoMinhKhoii/Kallo/commit/2d971db35b5656ebdca89ad7de2715aded05ee63))
* harden billing and subscriptions ([7384732](https://github.com/VoMinhKhoii/Kallo/commit/7384732cdee9c97303768bc1c164db1bdd597ad8))
* **identity:** editable display name + avatar photo upload (web + Flutter) ([2b922f0](https://github.com/VoMinhKhoii/Kallo/commit/2b922f0c4aa6694a39bf6cde0be5fa766380b80c))
* **identity:** rename with handle cascade + avatar photo upload, reconciled onto threads redesign ([0a667db](https://github.com/VoMinhKhoii/Kallo/commit/0a667db1d6908b750cb88a24a207b93f14afa9f6))
* **logging:** confirm before removing a meal (web + mobile) ([cdd4bc9](https://github.com/VoMinhKhoii/Kallo/commit/cdd4bc939aec9b1eb9ba2536f1337d2ac5e95346))
* **logging:** float the composer over the feed on mobile ([afb2c0c](https://github.com/VoMinhKhoii/Kallo/commit/afb2c0c5771cdbcc3e677de81e6b8942760cb799))
* **logging:** give the quick-log sheet the composer's mode selector ([bdd9c9a](https://github.com/VoMinhKhoii/Kallo/commit/bdd9c9aa4ae0c8041e00649aafbe04ab3289b26d))
* **logging:** icon action strips, auto-share opt-out, and feed polish ([372bc48](https://github.com/VoMinhKhoii/Kallo/commit/372bc48fc1de98f7de9c249cf6b21088d659f1d2))
* **logging:** inline the under-logged notice, rebuild the empty state, fix keyboard dismissal ([e10ac27](https://github.com/VoMinhKhoii/Kallo/commit/e10ac27cc8137c3a174e3ecb3bb678a3301ec599))
* **logging:** meal-card actions as icon strip beneath the card (web) ([cdb78c8](https://github.com/VoMinhKhoii/Kallo/commit/cdb78c8b0997651d54d7134f0d52dde8407efc33))
* **logging:** remove the precise-clarify ask-back UX on web and mobile ([cd39e94](https://github.com/VoMinhKhoii/Kallo/commit/cd39e94a40d7c06f38054c6e1e0cd169126e4692))
* **logging:** remove the precise-clarify ask-back UX on web and mobile ([3b9739e](https://github.com/VoMinhKhoii/Kallo/commit/3b9739ed62566da86f4926744a4d59d31ed1a52c))
* **logging:** render the precise-clarify question on web ([97aef68](https://github.com/VoMinhKhoii/Kallo/commit/97aef68c267da0eefcdf6ea7ce9a05a3e7f86442))
* **logging:** show the time on unsaved meals too ([5922358](https://github.com/VoMinhKhoii/Kallo/commit/592235847efbe1f8cb166b72217a7586fd4d56ed))
* **logging:** success toast when toggling circle share ([1cfe194](https://github.com/VoMinhKhoii/Kallo/commit/1cfe19476221b977313f201db0dd03faeabe5ef2))
* **logging:** supersede pending analyses via attempt_id upsert ([9169024](https://github.com/VoMinhKhoii/Kallo/commit/91690249e03e3d3d0095f4dbd8a5677f97c50353))
* **mobile:** 'Log again' on the meal action strip; correct the edit-amounts glyph ([5ef9573](https://github.com/VoMinhKhoii/Kallo/commit/5ef95738065bae8c7fed6e367425329c31c811d6))
* **mobile:** auto-share-to-circle toggle in settings ([559e98f](https://github.com/VoMinhKhoii/Kallo/commit/559e98f59bd1948cbf2e40525b6afa4ebcd69f80))
* **mobile:** edit amounts on saved meals; PATCH /api/v1/meals route ([a6dd82b](https://github.com/VoMinhKhoii/Kallo/commit/a6dd82b56538f1630d0ecab40b2221e84d5ec526))
* **mobile:** logging/settings/circle polish parity with web ([0216dc1](https://github.com/VoMinhKhoii/Kallo/commit/0216dc15cf1bbb01a794c554270d12e19b6ac77f))
* **mobile:** meal-card actions as icon row beneath the card ([9edf544](https://github.com/VoMinhKhoii/Kallo/commit/9edf5449efb83be9022b369f90a39b1e80b3bbd1))
* **mobile:** pipeline v2 client parity — clarify, attemptId supersede, inactivity watchdog ([e9d676d](https://github.com/VoMinhKhoii/Kallo/commit/e9d676d9af09d85bbb27a1720ba6b9957de83d48))
* **mobile:** port recent web UI/UX + pipeline v2 parity to Flutter ([5e2459a](https://github.com/VoMinhKhoii/Kallo/commit/5e2459a9429ee61f5d255be0ab8ead863129ae70))
* **mobile:** roll the calm type + density system across the app ([aa92183](https://github.com/VoMinhKhoii/Kallo/commit/aa9218340871c3d3b7b3d35cbcbc047b930313eb))
* **nutrition:** mirror mobile dominant card on web; unify skeleton loading across platforms ([e55e71e](https://github.com/VoMinhKhoii/Kallo/commit/e55e71ef173633779da2cfca9ed2c25ec1b8ef5a))
* **nutrition:** mirror mobile dominant card; unify skeletons ([0178291](https://github.com/VoMinhKhoii/Kallo/commit/01782918e038aeb996f35a6ac7c49613622c9827))
* **pipeline:** AI meal-pipeline overhaul — grounding architecture, golden-set eval, latency/accuracy fixes (phases 0-6) ([4184cd7](https://github.com/VoMinhKhoii/Kallo/commit/4184cd79834c0f17439aaf7528c5783e6dd53281))
* **portion:** piece-family vessels + integrated ruler picker ([3081c0b](https://github.com/VoMinhKhoii/Kallo/commit/3081c0bc3537959d7625214ddceb4e66a6b09794))
* **portion:** poultry piece family + DB food-group classification ([95dc8b2](https://github.com/VoMinhKhoii/Kallo/commit/95dc8b2d0b7715113a303debac2daf14b0d7c99f))
* **portion:** staging-card portion picker with ruler slider ([74f262e](https://github.com/VoMinhKhoii/Kallo/commit/74f262e45a2ed144ee4919cf9a9b99535402770f))
* **portion:** surface vessel to client + deterministic tier rescale ([59357ff](https://github.com/VoMinhKhoii/Kallo/commit/59357ff567beae54453e0df8515dee8547bfe47e))
* **portion:** vessel envelope threading + Call-2 prompt consolidation ([ee46bce](https://github.com/VoMinhKhoii/Kallo/commit/ee46bceda76be20931f051f33c7e8ff10ff7beef))
* **portion:** vessel-envelope data layer + Call-1 vessel extraction ([da1dc1a](https://github.com/VoMinhKhoii/Kallo/commit/da1dc1a1ddb3da4c069646b0f5aaed85fa555a93))
* **portion:** visual portion-reference system — vessel envelopes, assumption line, ruler-slider picker ([2338081](https://github.com/VoMinhKhoii/Kallo/commit/2338081680eb5883fa0933f607c3fb26c232c83b))
* **settings:** add list-row primitives, 4-anchor nav, i18n keys (phase A) ([2945dba](https://github.com/VoMinhKhoii/Kallo/commit/2945dbab8784e0968daa38da8fd1cc270f65bb0f))
* **settings:** auto-share-to-circle toggle on web + sharing API ([52650e4](https://github.com/VoMinhKhoii/Kallo/commit/52650e4fae2c2eadf8fc188cac4fbfdbe3c23837))
* **settings:** rebuild panels as grouped list-rows; split over-limit files (phases B-D) ([6ff9983](https://github.com/VoMinhKhoii/Kallo/commit/6ff9983a7e68145650303e90a0de4a377c91baf7))
* **settings:** restructure Threads-style, add a scroll separator, move sign out ([95cad41](https://github.com/VoMinhKhoii/Kallo/commit/95cad41edf9becaac783f9ca9cfe720326903a28))
* **sharing:** profile-level auto-share-to-circle opt-out (server side) ([9f07a9e](https://github.com/VoMinhKhoii/Kallo/commit/9f07a9ef24331840faa93e35e93fd2dad78825da))
* **shell:** put the scroll separator on every page, port the onboarding nudge ([db8961a](https://github.com/VoMinhKhoii/Kallo/commit/db8961adc2af4799eb35a38f332ae448edce674d))


### Bug Fixes

* **account:** harden deletion retries ([374736a](https://github.com/VoMinhKhoii/Kallo/commit/374736a72ab0f84334d774b3aeb4c389a3131b09))
* address CodeRabbit review — in-tx preference read, action validation, a11y ([43bda36](https://github.com/VoMinhKhoii/Kallo/commit/43bda36df022ab7855a7c76299b5f4860f40ecdb))
* address CodeRabbit review — retrieval resilience, streaming identity, resolver mass-units, fast-path gate, eval scoring, migrations ([0580b02](https://github.com/VoMinhKhoii/Kallo/commit/0580b025d3b27e39200fe6384ce931c724baac68))
* address CodeRabbit review comments ([0e08872](https://github.com/VoMinhKhoii/Kallo/commit/0e0887254fc798af27c82a29f41b96f68a157b95))
* address the code-quality review — one real bug, three latent, two duplications ([07e621d](https://github.com/VoMinhKhoii/Kallo/commit/07e621d67fa0ef1052cb1a1243deef43d2e79f73))
* **ai:** gate carb-staple items with implausible ~0g carbs; add bánh ướt food row ([9c62456](https://github.com/VoMinhKhoii/Kallo/commit/9c6245633932b6062ab4c65e93ea5912f7eace51))
* **analyze-meal:** stop web pipeline hanging on "Putting it all together…" ([73f9224](https://github.com/VoMinhKhoii/Kallo/commit/73f9224aedfb2fdb59726475106491199429fd80))
* **analyze-meal:** stop web pipeline hanging on "Putting it all together…" ([9ec9506](https://github.com/VoMinhKhoii/Kallo/commit/9ec9506863539c19b0e6c58504d8e35663205cde))
* **billing:** bind non-authoritative reconcile to the caller's customer ([0c84b3a](https://github.com/VoMinhKhoii/Kallo/commit/0c84b3a204720f3b33a05646955569af3cf2833d))
* **billing:** bound entitlement polling ([ce606a5](https://github.com/VoMinhKhoii/Kallo/commit/ce606a59760417eeebb7c33e221a034ae48f9349))
* **billing:** harden entitlement reconciliation ordering ([d7d6c1a](https://github.com/VoMinhKhoii/Kallo/commit/d7d6c1a97649b13d28dde053df29a6cf33dfeffb))
* **billing:** iOS payments hardening — paywall reconcile resilience + webhook Date-serialization fix ([4e84663](https://github.com/VoMinhKhoii/Kallo/commit/4e84663f18236bb7969320dcc6c1f559f2a7be81))
* **billing:** isolate paywall operation locks ([0ca98e9](https://github.com/VoMinhKhoii/Kallo/commit/0ca98e9fa2aef2bbefdfc74b0102106d1dfa9446))
* **billing:** reconcile masked RevenueCat grants ([cf6e3aa](https://github.com/VoMinhKhoii/Kallo/commit/cf6e3aae57b80f43019ad7f886d45f567f508d03))
* **billing:** reconcile stale entitlements on launch ([5bf781f](https://github.com/VoMinhKhoii/Kallo/commit/5bf781f9f8220bb1b66d9b2a9bf7b751f359f14e))
* **billing:** reconcile stale entitlements on launch ([2ba8563](https://github.com/VoMinhKhoii/Kallo/commit/2ba85638e354aedf6a6b5422f5960d7eb0d74e18))
* **billing:** serialize Date in raw sql for webhook reconciliation ([212c982](https://github.com/VoMinhKhoii/Kallo/commit/212c982de80495c195d7fea88eb259ad995755bb))
* **billing:** stabilize paywall lifecycle ([73f57f9](https://github.com/VoMinhKhoii/Kallo/commit/73f57f907388cc71308d6304e6823d7d5a3b7149))
* **billing:** stabilize paywall lifecycle ([faa0030](https://github.com/VoMinhKhoii/Kallo/commit/faa0030fe95948bcc8b502dd44544fd655d62885))
* **circle:** address CodeRabbit review on the Flutter port ([490b7fd](https://github.com/VoMinhKhoii/Kallo/commit/490b7fdcbfc101f48b0fd1a8761ea466a1e62924))
* **circle:** shared links use the public web origin, not the API host ([01e5b2f](https://github.com/VoMinhKhoii/Kallo/commit/01e5b2f608d8e5ec1c9098ba47565369cd03c9ab))
* **dashboard,logging:** Vietnamese heatmap labels, macro columns, equal legend ([90c8496](https://github.com/VoMinhKhoii/Kallo/commit/90c8496e71cf3d9c7c588d7b3d1bd1e7352ea10a))
* **dashboard:** give the weight chart headroom and real dates, loosen the heatmap bands ([367b3e5](https://github.com/VoMinhKhoii/Kallo/commit/367b3e515bd7433f2204277a095001ff849bd84a))
* **dashboard:** make auto-save failure recoverable ([ff7d6f2](https://github.com/VoMinhKhoii/Kallo/commit/ff7d6f262cd02bf5b5086a16b9c27771e056abdf))
* **dashboard:** make the adherence bands asymmetric and the legend discrete ([48e0431](https://github.com/VoMinhKhoii/Kallo/commit/48e04317471ca9bf9dfb1d965c0e4848c0c3f8c0))
* **dashboard:** surface precise clarify in quick-log; keep refine's timeline anchor through clarify ([17e4db6](https://github.com/VoMinhKhoii/Kallo/commit/17e4db6255246305ef145f2ca2ce6c8baa097f63))
* **db:** insert banh uot row via source_id FK, not dropped source column ([2ab0f8a](https://github.com/VoMinhKhoii/Kallo/commit/2ab0f8a90eebb07e9511586f0be443bc9c1c8475))
* **db:** re-timestamp banh uot migration after main's billing migrations ([ff1ea3d](https://github.com/VoMinhKhoii/Kallo/commit/ff1ea3db13b103a7bb01e65e88055085c70c53a7))
* **db:** re-timestamp banh uot migration to sort after main ([abc48c2](https://github.com/VoMinhKhoii/Kallo/commit/abc48c27dc612ab8de82af9fdc00421088732891))
* **design:** restore warm beige hover/select washes; whiten tinted cards ([b9d3430](https://github.com/VoMinhKhoii/Kallo/commit/b9d3430ed165f5928c11333a39fa825d82bca8cc))
* **design:** restore warm beige hover/select washes; whiten tinted cards ([49d3359](https://github.com/VoMinhKhoii/Kallo/commit/49d335913f02aa50de79ad5503474d6659b4ae27))
* **design:** whiten input bars and surface-tinted controls ([8874d9a](https://github.com/VoMinhKhoii/Kallo/commit/8874d9aa4d82d1dfc3ad4d16d49dc76b763464b9))
* **feedback:** collapse the nested card, share the logging Save button ([0209cff](https://github.com/VoMinhKhoii/Kallo/commit/0209cff81811651c92f92186cdab3a6f8ab36330))
* **identity:** address CodeRabbit review comments ([06ff4ec](https://github.com/VoMinhKhoii/Kallo/commit/06ff4ecd9a0d25e0502b85672333c2beaefc2db1))
* **identity:** address codex adversarial findings ([1527ac4](https://github.com/VoMinhKhoii/Kallo/commit/1527ac4d7542a356af9df294346f7d3fe9cea13d))
* **identity:** enforce avatar size/MIME caps at the storage bucket level ([c4574c3](https://github.com/VoMinhKhoii/Kallo/commit/c4574c3c085ec1aafcb1f560fa93ab56efe2d34e))
* **identity:** tighten avatars bucket size cap to 500 KB ([6fb416d](https://github.com/VoMinhKhoii/Kallo/commit/6fb416dbcaeea6ff86289ed61dbc6c154417319c))
* **logging,circle:** stop orphan pending-analysis duplicates; hide time for backfilled circle meals ([658fc04](https://github.com/VoMinhKhoii/Kallo/commit/658fc04100d24f12f55a6d2f41b2bf68e792f66b))
* **logging,circle:** stop orphan pending-analysis duplicates; hide time for backfilled circle meals ([#218](https://github.com/VoMinhKhoii/Kallo/issues/218)) ([2139120](https://github.com/VoMinhKhoii/Kallo/commit/2139120445072f8ec7d8c996758524a9da077aa9))
* **logging,dashboard,settings,circle:** six follow-ups from device review ([cc9956f](https://github.com/VoMinhKhoii/Kallo/commit/cc9956f5558f4d449eaf977c251bc82666c6553c))
* **logging:** add missing remove-confirm i18n keys ([fbbb536](https://github.com/VoMinhKhoii/Kallo/commit/fbbb53683ac815c9c9682eb62aa4f69020ed1426))
* **logging:** calorie ring stays truthful across every save & delete path ([f74b785](https://github.com/VoMinhKhoii/Kallo/commit/f74b7855ecc64674c374589b58021c2f457822cf))
* **logging:** don't let composer state outlive the account that wrote it ([859ae2f](https://github.com/VoMinhKhoii/Kallo/commit/859ae2fe299aaa3eab09df4bbde20dee7d612d3a))
* **logging:** don't let composer state outlive the account that wrote it ([a24a01a](https://github.com/VoMinhKhoii/Kallo/commit/a24a01a13df67707ed6b39954a6f650891dee960))
* **logging:** heal both rings when a dashboard quick-save is undone ([ae45412](https://github.com/VoMinhKhoii/Kallo/commit/ae45412efe15264c1bdeb90512ed25c60c44ee14))
* **logging:** heal calorie ring when a save races the day's initial fetch ([84517ce](https://github.com/VoMinhKhoii/Kallo/commit/84517cea615223bed61daa3de702b99ae35674f2))
* **logging:** heal the logging ring when a meal delete fails ([76a5577](https://github.com/VoMinhKhoii/Kallo/commit/76a5577cd0832bb2eeb7f31a73e63d43e33476da))
* **logging:** keep the composer dock a solid surface ([42a06d1](https://github.com/VoMinhKhoii/Kallo/commit/42a06d1675a3ea0317c14751733776cff1c0ed28))
* **logging:** live totals while editing amounts, no collapse flicker, visible steppers ([e9185ae](https://github.com/VoMinhKhoii/Kallo/commit/e9185ae887271ba280a59fa9fd6246495b26f6c0))
* **logging:** make the under-logged note an inset card with a dismiss ([19c876f](https://github.com/VoMinhKhoii/Kallo/commit/19c876f21b705e7b32052d7e9b236bce01008414))
* **logging:** re-arm the daily-meals heal over stale in-flight refetches ([725ba3d](https://github.com/VoMinhKhoii/Kallo/commit/725ba3dd8121913464019b9f96882f59af934a04))
* **logging:** re-arm the day heal when a second save cancels the first's refetch ([464dcbd](https://github.com/VoMinhKhoii/Kallo/commit/464dcbdbbfe8071e82f09d4190ef03e6fb4c1ad2))
* **logging:** re-measure the composer dock when it grows under the thumb ([ff9d76d](https://github.com/VoMinhKhoii/Kallo/commit/ff9d76d9deb998c8048d49a7a8abe39b68e2f059))
* **logging:** restore the ring label's casing, size it, and edge the chevrons ([d90e8a6](https://github.com/VoMinhKhoii/Kallo/commit/d90e8a6ba40633cdde61c60614a958c8dadc123a))
* **logging:** swap edit states in place — no overlapping animations ([47b1758](https://github.com/VoMinhKhoii/Kallo/commit/47b1758d6cea4b10a2433438a9a4ac2686006a9e))
* **logging:** two latent bugs the feed_area split surfaced ([7db4136](https://github.com/VoMinhKhoii/Kallo/commit/7db4136b090305aac7ea04f83b4307c00bdf51c6))
* make billing CI portable ([ca7707b](https://github.com/VoMinhKhoii/Kallo/commit/ca7707b98fdf5954f9ebff55df7ac6745305449c))
* **migrations:** consolidate pipeline columns into one drizzle-owned migration timestamped after main's applied set ([158e9b5](https://github.com/VoMinhKhoii/Kallo/commit/158e9b5b5042c8b0185d32c9c90a56c8876ee3fc))
* **migrations:** consolidate pipeline columns into one drizzle-owned migration with a post-main timestamp ([6f3819e](https://github.com/VoMinhKhoii/Kallo/commit/6f3819e073c0166bfa7da1c7cb4f0d5aabb575b2))
* **mobile:** cap Dynamic Type at 1.3x and tighten body/meta leading ([d24f938](https://github.com/VoMinhKhoii/Kallo/commit/d24f9384276341447f42cec37f7a0b702f48b534))
* **mobile:** finish Kallo copy migration ([499db7b](https://github.com/VoMinhKhoii/Kallo/commit/499db7bb2290eb84ae5f71f5426383248de91d36))
* **mobile:** grill-pass fixes — visible weight-field fill, centered brand marks, explicit retryable reset ([e27ddf4](https://github.com/VoMinhKhoii/Kallo/commit/e27ddf4a192460e36583a4dbcf6a8e28ce46b60b))
* **mobile:** refresh the dashboard ring on circle-originated meal logs ([fc18680](https://github.com/VoMinhKhoii/Kallo/commit/fc186806f3cb178d5a1a5f13d4ec7c4838238a07))
* **mobile:** restore toggled semantics on the circle-share icon ([0f285c0](https://github.com/VoMinhKhoii/Kallo/commit/0f285c0805f5e2de774bddf7d43f1100daa59731))
* **mobile:** sheet polish — warm chip fills on white sheets, header ellipsis, country title, DRY openers ([0722727](https://github.com/VoMinhKhoii/Kallo/commit/07227273c6fbb53657ff7374912b39a63dc9742f))
* **nutrition:** one kind of label in the range toggle, in both languages ([ef4991f](https://github.com/VoMinhKhoii/Kallo/commit/ef4991f76c66f852bf545fd95e8ed3d017847cdf))
* **onboarding:** drop the language monogram and the duplicated body-metrics copy ([97a9c9f](https://github.com/VoMinhKhoii/Kallo/commit/97a9c9f17bad2868ee7de574a92f38bac967793a))
* **paywall:** harden entitlement reconcile against races and transient failures ([a102221](https://github.com/VoMinhKhoii/Kallo/commit/a10222168a42a7e28cf1d676332ae9a00499c5e5))
* **pipeline:** close DEV-91 — v2 budget accounting, honest anomaly actions, chunk-failure retry path, dead-code sweep ([503d563](https://github.com/VoMinhKhoii/Kallo/commit/503d563a164952cc33a992c624987e3f941e7341))
* **pipeline:** route clarify before empty_nutrition; put prompt rules in the variants that actually run; anchor noncaloric patterns ([df19d43](https://github.com/VoMinhKhoii/Kallo/commit/df19d43e0aafcbee20c290b5495cad1a68fe7ad0))
* **pipeline:** zero-count inputs clarify instead of inventing a serving; pass quantity evidence to Call 2 ([b2cde06](https://github.com/VoMinhKhoii/Kallo/commit/b2cde0628a474094e2cf793b0470fd40b5cba50e))
* **portion:** FAO 'Meat and meat products' bucket buried poultry kind ([9f239fb](https://github.com/VoMinhKhoii/Kallo/commit/9f239fb479f7fd4727df49a4544bb8eced45061d))
* **portion:** gate picker behind confirm and use semantic color tokens ([074dae7](https://github.com/VoMinhKhoii/Kallo/commit/074dae73677ade6dee8998c68669ed9ab67024a4))
* **portion:** review-gauntlet fixes — commit-what-you-preview, envelope consolidation, classification guards ([56fdbc8](https://github.com/VoMinhKhoii/Kallo/commit/56fdbc8718c8e3afb8d9e4028805a5eb79b81600))
* **portion:** ruler glyphs ignored cbrt sizing (w-auto overrode width attr) ([261d761](https://github.com/VoMinhKhoii/Kallo/commit/261d7612d3cd5b2a1ec35a188fad9035d612af20))
* **portion:** thermo-review UI fixes — claim/commit parity, ESM cycle, keyboard step ([0957959](https://github.com/VoMinhKhoii/Kallo/commit/095795978ec360315c65ff2101130f42e57ef455))
* **settings,shell:** one bar that only re-titles, one 12px inset, drawer identity out ([e33cb6e](https://github.com/VoMinhKhoii/Kallo/commit/e33cb6ed85efe09670ff9c0060a19a4bcd0d08f6))
* **settings:** address CodeRabbit review — sign-out error key, a11y label, target clamp, rename logging ([40f859b](https://github.com/VoMinhKhoii/Kallo/commit/40f859be119f752e65a20ed627a4adce3b5dc889))
* **settings:** scroll-spy in inner scroll container; brand marks on linked accounts ([fdd775f](https://github.com/VoMinhKhoii/Kallo/commit/fdd775fbf5a5adc7461d470dfa26e52caf5ddb44))
* **sharing:** lock the profile row while reading the auto-share preference ([485c8e6](https://github.com/VoMinhKhoii/Kallo/commit/485c8e61e852c6930d9cebe55930d1d4867fbf7e))
* **shell:** pin sidebars against overscroll and scroll chaining ([65c2cf4](https://github.com/VoMinhKhoii/Kallo/commit/65c2cf425f04648c89c4ab2aa39ddbe56ad5393f))


### Performance

* **identity:** re-encode avatar uploads to 512px WebP server-side ([e7d7967](https://github.com/VoMinhKhoii/Kallo/commit/e7d79670762ac9f9bc4197c5548a4bf99d4e28d4))


### Refactor

* **analyze:** extract pending-analysis upsert; keep files under the size ratchet ([de4c570](https://github.com/VoMinhKhoii/Kallo/commit/de4c5703f5c485f4405cf2727255bc1f3238f22a))
* **circle,shell:** trim the Circle header, make the add menu native, match web's nav selection ([e0311e6](https://github.com/VoMinhKhoii/Kallo/commit/e0311e6f4c62616a847a48d53d72bd6463077d6e))
* **circle:** drop dead heart ternary, type the unread feed param ([27b68ab](https://github.com/VoMinhKhoii/Kallo/commit/27b68ab38d37fcf196b596986f630b2cf62bf918))
* **circle:** unify avatar widgets on one tinted disc ([0b59fa6](https://github.com/VoMinhKhoii/Kallo/commit/0b59fa686fab81ac11a839840f8edb16c88e3f9a))
* **circle:** unify avatar widgets on one tinted disc ([9b0339e](https://github.com/VoMinhKhoii/Kallo/commit/9b0339ed34278a88de0fceb37881bae9dab6dad8))
* **circle:** use NhamTextStyles.sansMedium for avatar initial ([31fd73a](https://github.com/VoMinhKhoii/Kallo/commit/31fd73ad5e0a913d10304ab6ad8385f6c27293e5))
* **dashboard,settings:** close the gaps the consistency audit found ([2ce594c](https://github.com/VoMinhKhoii/Kallo/commit/2ce594c51891a9f288f6c7c2cb58476db315a154))
* **dashboard:** make attempt-id lifecycle self-contained ([3ce9195](https://github.com/VoMinhKhoii/Kallo/commit/3ce91955f7e6fd9cb01f5d4e6a1bfa26fb757cd5))
* **dashboard:** port to the calm type scale and one spacing rhythm ([db45354](https://github.com/VoMinhKhoii/Kallo/commit/db45354f9e23ed498340529bd1ca5024ee6daab7))
* **hooks:** move component-colocated hooks into hooks/ ([0313e7b](https://github.com/VoMinhKhoii/Kallo/commit/0313e7b064364ba1f0a34f8c7546668fad8f9a9c))
* **identity:** reuse useInvalidateIdentity in useSaveProfile ([e7c8cdc](https://github.com/VoMinhKhoii/Kallo/commit/e7c8cdcaa1d584f583b2154989edfdf83a214a78))
* **logging:** break feed_area apart ([8a9fc63](https://github.com/VoMinhKhoii/Kallo/commit/8a9fc63825587b969118fef3052bfc2d7620cc1f))
* **logging:** drop the composer dock's blur veil ([81f0e10](https://github.com/VoMinhKhoii/Kallo/commit/81f0e10610c663c5dcccd6d6ca46e742f7bd4650))
* **logging:** drop the dead pending-analysis attempt_id echo ([6fdb817](https://github.com/VoMinhKhoii/Kallo/commit/6fdb8177bafea9524e91db666578842f575a1670))
* **logging:** make the account-change reset testable, mirror the test path ([5dc305b](https://github.com/VoMinhKhoii/Kallo/commit/5dc305ba9d3e6d9734571c9ee83e59c699b68185))
* **pipeline:** thermo review — delete dead prompt variants, untrack eval JSONs, extract prepare-grounding, unify attempt-usage hooks ([20cb492](https://github.com/VoMinhKhoii/Kallo/commit/20cb492960905fa5025ef745bf041afb1e5bc953))
* **portion:** delete dead vessel code paths; ship assets as webp ([cd11138](https://github.com/VoMinhKhoii/Kallo/commit/cd111388a511fce918ba182f73fa0e25f329a898))
* **settings:** lean grouped list-row revamp of the web settings surface ([42b40b4](https://github.com/VoMinhKhoii/Kallo/commit/42b40b485b2c81015b3b019418919e74291a12e1))
* **settings:** polish pass — drop page header, scroll-spy nav, subsection-only dividers, inline rows ([f48ee80](https://github.com/VoMinhKhoii/Kallo/commit/f48ee808138eb30cdf4a97c82e7886cc4e84978e))
* **settings:** top-align inline row controls ([72baf7d](https://github.com/VoMinhKhoii/Kallo/commit/72baf7d014d3df124736becc04a56eee81a91cbd))
* **settings:** unify the surface — language dropdown, iconized option strips, token sweep ([fb6567b](https://github.com/VoMinhKhoii/Kallo/commit/fb6567bf2e9624b49dfe7d826006992046d97fc8))
* thermo-nuclear review cleanups — single boundaries, shared shapes ([ac732a9](https://github.com/VoMinhKhoii/Kallo/commit/ac732a9e49b0f1870dc09c70cf1005158f8775ba))
* thermo-review cleanups — single sources of truth, real seams, grouped folders ([4107a04](https://github.com/VoMinhKhoii/Kallo/commit/4107a04d8c7b132a0442c21b892e990524ec03df))


### Documentation

* **design:** gate the density rules on device validation, add a porting recipe ([6b68efe](https://github.com/VoMinhKhoii/Kallo/commit/6b68efed57425386a59f520f58b919bbaffb7766))
* **design:** mark the density system validated and record what shipped ([82028c1](https://github.com/VoMinhKhoii/Kallo/commit/82028c1c91f213fcde6c8ab463c8ada4fc8c66a0))
* **design:** put the two spacing sections next to each other ([f296286](https://github.com/VoMinhKhoii/Kallo/commit/f2962869be7095ea3222f289fd2498bf8e4f5706))
* **design:** reconcile the 12px default with the logging feed's 8px ([430d2b8](https://github.com/VoMinhKhoii/Kallo/commit/430d2b846313ced3ccfdbd257051bd6bb955b70f))
* **ttr:** add language identifiers to fenced code blocks ([eb31d70](https://github.com/VoMinhKhoii/Kallo/commit/eb31d70d54cb03f2ebc71e5c814d528c168242aa))
* **ttr:** add task-board doc and reusable task templates ([beb63be](https://github.com/VoMinhKhoii/Kallo/commit/beb63bec50dc54e25984738b3a1f8d3c67c001aa))
* **ttr:** AI cost breakdown task file (uploaded as DEV-85) ([5892cfc](https://github.com/VoMinhKhoii/Kallo/commit/5892cfca857cf76de385c383669e32f33ee6c3df))
* **ttr:** Phase 6 findings — eval report (DEV-86), data curation (DEV-87), accuracy backlog (DEV-88), local tooling fixes (DEV-89) ([0f7eef1](https://github.com/VoMinhKhoii/Kallo/commit/0f7eef15e47ea75a75407e13d0c123b5888c78a7))
* **ttr:** task-board doc and reusable task templates ([0c4d30f](https://github.com/VoMinhKhoii/Kallo/commit/0c4d30f9148cc62a763b6fa8e84ce75b9454f021))
* **ttr:** v2 pipeline architecture reference (uploaded as DEV-90) ([9b29bcb](https://github.com/VoMinhKhoii/Kallo/commit/9b29bcbf65024d32e14f08558871b3eafe011912))

## [1.8.0](https://github.com/VoMinhKhoii/Kallo/compare/v1.7.0...v1.8.0) (2026-07-18)


### Features

* **agents:** add project-local thermo-nuclear-code-quality-review skill ([a019b2d](https://github.com/VoMinhKhoii/Kallo/commit/a019b2d56bda4e299944caeb4bcccb244c4b755b))
* **brand:** add Kallo wordmark to web and mobile sidebars ([e753e90](https://github.com/VoMinhKhoii/Kallo/commit/e753e90dfedb307ab0d4b5c3e86d71706409360c))
* **brand:** approve segmented K mark and Kallo wordmark geometry ([d7943f0](https://github.com/VoMinhKhoii/Kallo/commit/d7943f05eae6e5668cca53ce4c232a1544996d23))
* **brand:** collapsed-rail K toggle morph and app-icon placements ([35a8ed3](https://github.com/VoMinhKhoii/Kallo/commit/35a8ed38894794e32b62d0ad1225fba6ac65bd72))
* **brand:** generate full Kallo asset library from approved mark ([70dbac6](https://github.com/VoMinhKhoii/Kallo/commit/70dbac6381140019a5744d3114241301e0bd7dc7))
* **brand:** Kallo identity — segmented K mark, wordmark, and full rollout ([997ea00](https://github.com/VoMinhKhoii/Kallo/commit/997ea005bbc3cf84393e8304f6ddeba1ef48b4c7))
* **brand:** rename user-facing surfaces to Kallo and wire the wordmark ([05a952d](https://github.com/VoMinhKhoii/Kallo/commit/05a952db96b6bd64b7b4b3aac59ad2ca3e11bd93))
* **brand:** wire Kallo icons into Flutter web target ([8447ecf](https://github.com/VoMinhKhoii/Kallo/commit/8447ecf0981ce09e295d3c54e4e2fcce7966b26a))
* **brand:** wire Kallo icons into web and mobile surfaces ([ef3a1e0](https://github.com/VoMinhKhoii/Kallo/commit/ef3a1e074defbffdadecca6e5bde71219338eb0e))
* **ci:** enforce 400/200 LOC file-size limits with a ratchet baseline ([bcc1932](https://github.com/VoMinhKhoii/Kallo/commit/bcc1932191ef5d051d511486e28dad8e16ea3eec))
* **circle:** friends unread highlight ([76f1f17](https://github.com/VoMinhKhoii/Kallo/commit/76f1f1777a2bdd3c247c86c2ebd865f6f02271da))
* **circle:** group timeline, reactions, and recipient-initiated copies ([835513b](https://github.com/VoMinhKhoii/Kallo/commit/835513bff1bb33040a19f5d3bb523c235d3d7099))
* **circle:** merge friends into one combined thread ([812827c](https://github.com/VoMinhKhoii/Kallo/commit/812827ced849fa3d228146d1128a9cb79665d785))
* **circle:** redesign /groups as a Threads-style centered feed ([4f44cd4](https://github.com/VoMinhKhoii/Kallo/commit/4f44cd45289f23e7e4e73d3d387200f821a53e46))
* **circle:** scrollable thread history + thread subtitles ([7f90411](https://github.com/VoMinhKhoii/Kallo/commit/7f90411f49fbe95239a258d31c6f3623e21cd7bb))
* **circle:** threads feed redesign, replies, group management, backend consolidation ([5debe0f](https://github.com/VoMinhKhoii/Kallo/commit/5debe0f0f4bf71ca68d67e0aaa094778dd33b5d0))
* **circle:** Threads-style Circle redesign — feed, replies, reactions, group management ([c554ec2](https://github.com/VoMinhKhoii/Kallo/commit/c554ec27a586c32e09ef3def826294b7e7231070))
* **circle:** unread highlight, mark-as-read, and recency sort for threads ([ba738f0](https://github.com/VoMinhKhoii/Kallo/commit/ba738f0ee1cf5d3facd0eb68132d6356e6094aaf))
* **social:** meal copy/split sharing + Circle chat groups ([27b9d7b](https://github.com/VoMinhKhoii/Kallo/commit/27b9d7b58f40250ae110e9e4b11336c5ce1ba710))
* **social:** share meals with friends via copy or split ([f41bffc](https://github.com/VoMinhKhoii/Kallo/commit/f41bffc865e78a2c30d27183bd73d58f96307968))
* **ui:** add EmptyState foundation component; adopt in Circle feed ([870a66f](https://github.com/VoMinhKhoii/Kallo/commit/870a66f232533a112477335e827a1ece370053ca))


### Bug Fixes

* **auth:** close pre-hydration gaps in webview detection ([a803204](https://github.com/VoMinhKhoii/Kallo/commit/a803204be61db4d0fdc81896fa868021b1b24472))
* **auth:** handle Google OAuth block in in-app browsers ([3026f24](https://github.com/VoMinhKhoii/Kallo/commit/3026f24f35170fe3e1042326e6dd443fdcfcd418))
* **auth:** handle Google OAuth block in in-app browsers ([8e4bdcd](https://github.com/VoMinhKhoii/Kallo/commit/8e4bdcde168de1458786f7b8bbc5991e3d57e360))
* **auth:** resolve webview detection after hydration ([c068f7c](https://github.com/VoMinhKhoii/Kallo/commit/c068f7ce08312422eb619d600cd63699e269af92))
* **build:** drop value/type re-exports from the meal-sharing use-server barrel ([fe927e0](https://github.com/VoMinhKhoii/Kallo/commit/fe927e0b0a00879fca204ad229edfc4163c0e4b1))
* **circle:** address adversarial review — dialog tab, invites overflow, switcher error state ([e975a4f](https://github.com/VoMinhKhoii/Kallo/commit/e975a4fb61fb81eb9c4fa72fe4681a68a6870b94))
* **circle:** permanent redirect for retired friends route, hide avatar initial from AT ([babd02e](https://github.com/VoMinhKhoii/Kallo/commit/babd02e7855f4a96543eda027577cc523cbc7b60))
* **social:** close adversarial-review findings; lock chat tables to server-only ([56c23d3](https://github.com/VoMinhKhoii/Kallo/commit/56c23d37e0c6afbc4d100e998c2649e69daef6a1))
* **social:** harden share flow + direct-chat access per cross-model review ([6698bb3](https://github.com/VoMinhKhoii/Kallo/commit/6698bb32fd218531297787d0e655e4340f1c7b7b))


### Refactor

* **actions:** split meals server actions into per-concern modules ([48ab603](https://github.com/VoMinhKhoii/Kallo/commit/48ab603cfec1ddc2c1a634ed7b46bb42c1a802db))
* **admin:** split health and prompt queries out of queries.ts ([a1c5ab6](https://github.com/VoMinhKhoii/Kallo/commit/a1c5ab6ad72570a478d082ef0d2e33ac18bb894a))
* **admin:** split pipeline-summary into per-concern modules ([d6b46ab](https://github.com/VoMinhKhoii/Kallo/commit/d6b46ab0b9a93d73e75cdddd8fa70d65ea004034))
* **ai:** extract retry loop and embedding methods from gemini.ts ([523b2c4](https://github.com/VoMinhKhoii/Kallo/commit/523b2c4252e454395738c3fc2f4045e26b19edd9))
* **api:** extract request validation from the analyze-meal route ([4cafa84](https://github.com/VoMinhKhoii/Kallo/commit/4cafa849d5177874fe554f7d70340fe5f3204426))
* **api:** split analyze-meal debug route into step modules ([8e78155](https://github.com/VoMinhKhoii/Kallo/commit/8e781555bbb76e938cfe32c2f6ffb7f6fd9d0f0d))
* **brand:** split brand additions out of baselined files for the size ratchet ([06b56d6](https://github.com/VoMinhKhoii/Kallo/commit/06b56d6a94f9b9c077fe673e89ab91d55b873053))
* **circle:** borderless Threads-minimal feed + Circle nav label ([9e305c1](https://github.com/VoMinhKhoii/Kallo/commit/9e305c1d4e46c219f9d0c05230d353dcca3e91c0))
* **groups:** split circle service functions into per-domain modules ([9eeb4d6](https://github.com/VoMinhKhoii/Kallo/commit/9eeb4d6247a14ea80081d2a1558c26e80ace207b))
* **hooks:** extract optimistic-cache helpers from use-meal-mutations ([029afed](https://github.com/VoMinhKhoii/Kallo/commit/029afed1f2e75eeb10ecc1fc6d190e226c694926))
* **logging:** split FeedArea into view + controller + focused hooks ([77412e4](https://github.com/VoMinhKhoii/Kallo/commit/77412e4409aa2ba358ff1f3a649ffefa74cde261))
* **logging:** split PersistedMealCard into per-concern modules ([88f86f0](https://github.com/VoMinhKhoii/Kallo/commit/88f86f05fe5d8ae972ae82166bf9e390f2094643))
* **matching:** extract Phase 3b alias fallback from cascade.ts ([acba9af](https://github.com/VoMinhKhoii/Kallo/commit/acba9af1ddd6f607ce5f9d234e66709c8ca87838))
* **matching:** split source-matching into constants/ranking/matcher ([c1f9387](https://github.com/VoMinhKhoii/Kallo/commit/c1f93872eb470ef4953a734acfdf6a26e8146c50))
* **meals:** extract copyMealVerbatim, dedupe re-log and accept-share ([f45365a](https://github.com/VoMinhKhoii/Kallo/commit/f45365a085d39cb5a02cdd26704f74028a6bd1bc))
* **mobile:** split oversized Flutter widgets for the file-size ratchet ([e7e4ab7](https://github.com/VoMinhKhoii/Kallo/commit/e7e4ab7407f5163498f3a00a4c2c32b596564e13))
* **onboarding:** split ScreenBodyMetrics into body-metrics modules ([30a678d](https://github.com/VoMinhKhoii/Kallo/commit/30a678dc07cef888cdf5773fb2c750ef95757bf6))
* **pipeline:** extract bounded-macro math from nutrition.ts ([ce0c426](https://github.com/VoMinhKhoii/Kallo/commit/ce0c4266bed5bf9dab12aec56d831418705ed3bd))
* **pipeline:** extract orchestrator leaf modules ([bd9f75a](https://github.com/VoMinhKhoii/Kallo/commit/bd9f75ab22bd59cc5e88ce018e4e2a4afdb4d5a5))
* **pipeline:** split grounded-orchestrator (v2) into stage modules ([f129964](https://github.com/VoMinhKhoii/Kallo/commit/f1299646551342e0562087c97a29de1fe028ada0))
* **pipeline:** split runPipeline into stage modules under 400 LOC ([b59cac6](https://github.com/VoMinhKhoii/Kallo/commit/b59cac642a8cd1c99daba67ffb3923e25941cda9))
* **pipeline:** split v2/grounded/cheat schemas into schemas-v2.ts ([189ea5a](https://github.com/VoMinhKhoii/Kallo/commit/189ea5a725b59fc5e43f9893df1ff3dfae066422))
* **pipeline:** split v2→v1 verdict helpers out of bridge.ts ([5f83fb3](https://github.com/VoMinhKhoii/Kallo/commit/5f83fb30c863b278cbbb3a4492d131a6463f641c))
* **rate-limit:** split analysis-guards into focused modules ([21dd9bf](https://github.com/VoMinhKhoii/Kallo/commit/21dd9bf92ab167a5b7e0a239aa10bb662386138c))
* split oversized web files to satisfy the file-size ratchet ([6700d74](https://github.com/VoMinhKhoii/Kallo/commit/6700d74f958fd97701eb6e17e67fd3fd9bac9e5d))
* split oversized web files under the 400/200 LOC gate (wave W1-W2) ([4dd644a](https://github.com/VoMinhKhoii/Kallo/commit/4dd644a7f97755b7cef7aadf7cbed61b8e692eec))


### Documentation

* **agents:** lean root AGENTS.md, nested Flutter AGENTS.md, drop stale docs ([561875d](https://github.com/VoMinhKhoii/Kallo/commit/561875d50bafb8b070e6bacb4e000c623b4e77a9))

## [1.7.0](https://github.com/VoMinhKhoii/Kallo/compare/v1.6.0...v1.7.0) (2026-07-11)


### Features

* **api:** accept cheat slider levels on v1 confirm + cheat occasion routes ([c7b729d](https://github.com/VoMinhKhoii/Kallo/commit/c7b729d51282a950737ec061d9aecc29de0206f8))
* **dashboard:** boxless streaming ticker, sidebar dim, richer stream voice ([0228891](https://github.com/VoMinhKhoii/Kallo/commit/0228891c104e506bfaea6dbf7fc624c71b9f5601))
* **dashboard:** calm redesign — overlap fix, lean weight card, hardened type/color/chrome ([b89a8d3](https://github.com/VoMinhKhoii/Kallo/commit/b89a8d32361fdf155d807505bcf717181acb8dc9))
* **dashboard:** calm redesign + in-place streaming meal log ([b940041](https://github.com/VoMinhKhoii/Kallo/commit/b940041c175a5ca2d13507e392c034539e542e2a))
* **dashboard:** separate inputs from displays + adopt the calm system ([d3adec9](https://github.com/VoMinhKhoii/Kallo/commit/d3adec9570c153e20a94d43749a6037cf5e91a6e))
* **dashboard:** separate inputs from displays and adopt the calm system ([5e4add0](https://github.com/VoMinhKhoii/Kallo/commit/5e4add096c13f76f39442e4c3e2420f1fa8f829a))
* **dashboard:** stream meal analysis in place in the input bar ([e2e79e5](https://github.com/VoMinhKhoii/Kallo/commit/e2e79e5fd8ecb2d004bd115fc54148d5a7df4c0b))
* **dashboard:** width-driven heatmap squares in a content-sized card ([799d14f](https://github.com/VoMinhKhoii/Kallo/commit/799d14fc02df7561f1416bdaa00065b7a77a61a4))
* **deploy:** kallo.fit production launch — kallo-prod service, Cloudflare origin-lock, SEO ([376caf7](https://github.com/VoMinhKhoii/Kallo/commit/376caf7ccfee371be8722f185e56da519ba5bb15))
* **deploy:** kallo.fit production launch (kallo-prod, Cloudflare origin-lock, SEO) ([c14f8e0](https://github.com/VoMinhKhoii/Kallo/commit/c14f8e0da26cba8e12c9c8c0ab14390063a753f1))
* **design:** codify design-system foundations on Anthropic-calibrated tokens ([5a26ffc](https://github.com/VoMinhKhoii/Kallo/commit/5a26ffcaa0c5b7a99b45ea6bb1a4436255f3da97))
* **feedback:** add in-app user feedback on web + mobile ([88d9a71](https://github.com/VoMinhKhoii/Kallo/commit/88d9a7184f58da34cd55a2beb9c9a2e4f7208f96))
* **feedback:** in-app user feedback (bug / ingredient / idea) on web + mobile ([0d7f423](https://github.com/VoMinhKhoii/Kallo/commit/0d7f423ca398dce4dd5f505e78c3a01b5e833664))
* **landing-lab:** rebuild v3 as the scroll-morphing cuisine globe ([a91d60a](https://github.com/VoMinhKhoii/Kallo/commit/a91d60ac1f1196e193af8b13afab7df814948c3c))
* **landing-lab:** v3 cuisine globe — scroll-morphing continent tour with real day/night ([33637aa](https://github.com/VoMinhKhoii/Kallo/commit/33637aa07a37c9968ca847684220306305907f77))
* **mobile-nutrition:** stacked bar macro chart + accurate calorie over/under ([bf60115](https://github.com/VoMinhKhoii/Kallo/commit/bf60115ea256765fd19f796c4d83259ba21e2bda))
* **mobile/settings:** regroup Settings into Threads-style cards ([fee3458](https://github.com/VoMinhKhoii/Kallo/commit/fee34586c10d988baf5ea0c142c827ad88bc1dd4))
* **mobile:** cheat-meal data layer (models, slider math, SSE event, providers) ([e9f342a](https://github.com/VoMinhKhoii/Kallo/commit/e9f342a9662a8ea547f1f4a0acef419c8bbd4c53))
* **mobile:** cheat-meal logging UI + l10n ([68b5b4f](https://github.com/VoMinhKhoii/Kallo/commit/68b5b4fd2c1425d1b61ceee017a840e178d06bfc))
* **mobile:** neutral cheat days on the adherence heatmap ([eb04093](https://github.com/VoMinhKhoii/Kallo/commit/eb0409387a09274cbefdfda92f2023b0951b0d9f))
* **nutrition:** All/Complete calorie averages with buttery swap ([9a7be2a](https://github.com/VoMinhKhoii/Kallo/commit/9a7be2a49413f68f4451584adb0980d948c8acaa))
* **nutrition:** stacked bar chart + All/Complete calorie averages with swap ([27acee4](https://github.com/VoMinhKhoii/Kallo/commit/27acee4d5711aa00c188b10e3ff80cc321eec0a5))
* **web:** lean dashboard + nutrition to match the Flutter calm system ([cdd7a3f](https://github.com/VoMinhKhoii/Kallo/commit/cdd7a3fa505ee42698888f5d6b02b499791520bc))


### Bug Fixes

* **auth:** harden proxy allowlist + verify emailed links via Cloud Run ([0e22059](https://github.com/VoMinhKhoii/Kallo/commit/0e220597692ebb1c85e60fd501cd034ce30b1175))
* **auth:** harden proxy allowlist + verify emailed links via Cloud Run ([0de4606](https://github.com/VoMinhKhoii/Kallo/commit/0de4606ab771e150bf9e9ab74d61494aca4bf56d))
* **auth:** pin browser client cookie name to the Supabase project ref ([bfaeac5](https://github.com/VoMinhKhoii/Kallo/commit/bfaeac548016af1abc2cf6f6425aa1c4fa746d62))
* **dashboard:** always show the weight chart over a fixed 30-day window ([506cd81](https://github.com/VoMinhKhoii/Kallo/commit/506cd81cdb61dc1828bf5cb530f367cc94638dda))
* **dashboard:** center the heatmap cluster horizontally; taupe empty cells ([63dc911](https://github.com/VoMinhKhoii/Kallo/commit/63dc91163d79961b991da24307614f8e08798f86))
* **dashboard:** definite chart height below xl; tighter Today row; hidden meal scrollbar ([8aadeaf](https://github.com/VoMinhKhoii/Kallo/commit/8aadeaf9dc74c62f6ce341e68ffb99d9a610b59b))
* **dashboard:** keep heatmap cells square, guarantee full-width fill via row minimum ([04a53ba](https://github.com/VoMinhKhoii/Kallo/commit/04a53bad5be137e06cb876d60c09adad416d9136))
* **dashboard:** stretch-fit heatmap cells to both axes; air below the input bar ([747f4b2](https://github.com/VoMinhKhoii/Kallo/commit/747f4b2a566f69610d46b9008f8e1a6fcc7f7d75))
* **dashboard:** warm cream tooltip ink on the espresso surface (CodeRabbit) ([e77fa40](https://github.com/VoMinhKhoii/Kallo/commit/e77fa40880b73d040370587232ebf8bd1891b5e0))
* **deploy:** fix smoke-check exit-code leak; address review ([367dc5a](https://github.com/VoMinhKhoii/Kallo/commit/367dc5a469082209eba87f0ee5ada2587540a793))
* **deploy:** make cloud-run-prod first-deploy-aware ([2dfcee9](https://github.com/VoMinhKhoii/Kallo/commit/2dfcee9b86ce0e03684c5b34d489a7129ec4a090))
* **deploy:** make cloud-run-prod first-deploy-aware ([91e1816](https://github.com/VoMinhKhoii/Kallo/commit/91e18162dce5e327849c2f3ec21fb06917771fcd))
* **feedback:** cache mobile screenshot upload; harden upload quota ([338d9c5](https://github.com/VoMinhKhoii/Kallo/commit/338d9c5a307acd8c23b5152edf74bde69752b23a))
* **feedback:** drop web screenshot object-URL preview ([76539fd](https://github.com/VoMinhKhoii/Kallo/commit/76539fd7f180b19a301217471fe64bad86a95d8a))
* **feedback:** RLS-enforce screenshot upload + mount service-role secret ([4dcb3db](https://github.com/VoMinhKhoii/Kallo/commit/4dcb3db3086d042f49cf093de52fa3eb0604f172))
* **feedback:** upload screenshots via user session so RLS enforces ownership ([9cc6424](https://github.com/VoMinhKhoii/Kallo/commit/9cc642474520146edd294087e7d2de040bf7f006))
* **landing-lab:** address CodeRabbit review — dish guard + reduced-motion entrances ([800fe8a](https://github.com/VoMinhKhoii/Kallo/commit/800fe8a400a23bbcf701922b0861b0d7ba072ac5))
* **mobile/settings:** keep button semantics on disabled rows; retry busy state ([c0356b1](https://github.com/VoMinhKhoii/Kallo/commit/c0356b1fabc2fada8e1d72938b36df983820530a))


### Refactor

* **dashboard:** derive the stream ticker; collapse retry; polish loaders ([7aee8e5](https://github.com/VoMinhKhoii/Kallo/commit/7aee8e5a3287cb6f03cc24cdbb8a877d5844bb21))
* **dashboard:** pure-CSS heatmap layout — 1fr columns + aspect-square cells ([5d32912](https://github.com/VoMinhKhoii/Kallo/commit/5d32912fedcdc4524158d72ccd3328471f740586))
* **design:** adopt cn() for conditional classes; fix truncation ([ee771b5](https://github.com/VoMinhKhoii/Kallo/commit/ee771b5204c1dd8b82797113aeb544c8084724b3))
* **design:** adopt cn() in specimen components, drop dead eyebrow tokens ([5e4dd66](https://github.com/VoMinhKhoii/Kallo/commit/5e4dd66551466bea69dc9583418e01f0583168dd))
* **design:** sweep hardcoded warm hexes onto nham tokens ([ab15543](https://github.com/VoMinhKhoii/Kallo/commit/ab15543132f09887fec5cee72a2a085bd41f914c))
* **landing-lab:** keep only the winning v3 cuisine globe ([e32b546](https://github.com/VoMinhKhoii/Kallo/commit/e32b5462de776cab44f00102f2b23449c7e980e4))
* **mobile/settings:** align Settings rows on a shared icon gutter ([6ce9692](https://github.com/VoMinhKhoii/Kallo/commit/6ce96923e73cfc04e38a6dd432c786fabe99e3fd))
* **mobile/settings:** drop grouped-card surfaces, keep flat rows ([8bc2a91](https://github.com/VoMinhKhoii/Kallo/commit/8bc2a911c30d007b4697f4f3c7e536182ee47822))
* **mobile:** dedup cheat badge + fix curved-animation lifecycle ([1c35f29](https://github.com/VoMinhKhoii/Kallo/commit/1c35f2909e4ba4bf35d523f69debeaf29cafff76))
* **web:** apply post-redesign cleanups ([11a9a1c](https://github.com/VoMinhKhoii/Kallo/commit/11a9a1c600c714810babb7c064533a5d6b4c88a9))


### Documentation

* **mobile:** note cheat-meal parity in the architecture doc ([2f47237](https://github.com/VoMinhKhoii/Kallo/commit/2f4723770fe531a6a3d0e6c4a384ec071e448803))

## [1.6.0](https://github.com/VoMinhKhoii/Nham/compare/v1.5.0...v1.6.0) (2026-07-02)


### Features

* **barcode:** serving- and package-based amount selection ([a19808f](https://github.com/VoMinhKhoii/Nham/commit/a19808f99616f8b00145bc004210da83e5a91a0e))
* **circle:** port Circle (Groups) to the Flutter app at full parity ([b4f531f](https://github.com/VoMinhKhoii/Nham/commit/b4f531f661835d6e94487d7023bc79364efa60d4))
* **circle:** port Circle (Groups) to the Flutter app at full parity ([184d1f3](https://github.com/VoMinhKhoii/Nham/commit/184d1f3cbe3fd6875a42328f9493840da2c22053))
* **dashboard:** redesign weight chart (web + Flutter) with single-source forecast ([7506c25](https://github.com/VoMinhKhoii/Nham/commit/7506c251dafc6f5f1d0fa14891f37c2e18f0a921))
* **mobile:** port barcode scanning to the Flutter app ([52a0e79](https://github.com/VoMinhKhoii/Nham/commit/52a0e796f16e6c20727e487e1ab2465ec3d48c33))
* **mobile:** port barcode scanning to the Flutter app ([9ac2d7c](https://github.com/VoMinhKhoii/Nham/commit/9ac2d7c9285d96a68001c9975859222af3dd233c))


### Bug Fixes

* **auth:** proxy Supabase auth through Cloud Run for VN-blocked networks ([1cc1edd](https://github.com/VoMinhKhoii/Nham/commit/1cc1edd8640c09a43d6e74f476a1d16c464b4e7a))
* **circle:** address CodeRabbit review ([94d464a](https://github.com/VoMinhKhoii/Nham/commit/94d464a5acbf3de7a62115501905eccf34e617d0))
* **mobile:** apply pre-PR review fixes to barcode flow ([6eecaa6](https://github.com/VoMinhKhoii/Nham/commit/6eecaa683bda25162df3f85516596017bb98dca6))
* **mobile:** make the log sheet scroll-safe on short layouts ([a0ca934](https://github.com/VoMinhKhoii/Nham/commit/a0ca934ae2ae563757fc39f47d75ac96b33e5179))
* **mobile:** only add home-indicator inset when keypad is hidden ([b0caf57](https://github.com/VoMinhKhoii/Nham/commit/b0caf574db1c192d8f59c8d28bd3de96361c000b))
* **mobile:** pin log-weight Save button just above the keypad ([e5b84dc](https://github.com/VoMinhKhoii/Nham/commit/e5b84dc5c1bec19ea7bc356bc08f451b2b7724e6))
* **mobile:** size log-weight sheet to its content ([4885d48](https://github.com/VoMinhKhoii/Nham/commit/4885d48f208340ba82d7bd041155cb8cc477ce71))
* **mobile:** size log-weight sheet to its content ([42a57c7](https://github.com/VoMinhKhoii/Nham/commit/42a57c7c7fc9e5d8428588d8dd3fce359eb7d4cc))
* **settings:** let the settings header back button pop the route ([3cf7a46](https://github.com/VoMinhKhoii/Nham/commit/3cf7a46feec50ec1c59a4c2ccae55d25e1fee579))


### Documentation

* **design:** fold the mobile system into the nham-design skill ([8a80c07](https://github.com/VoMinhKhoii/Nham/commit/8a80c07e437c3a8fab503e1069fc55dd7deebd8b))

## [1.5.0](https://github.com/VoMinhKhoii/Nham/compare/v1.4.0...v1.5.0) (2026-07-01)


### Features

* **auth:** enforce one account per email + Connect-account flow ([21b3de1](https://github.com/VoMinhKhoii/Nham/commit/21b3de181483dd99284207f4783e1327fee9b82e))
* **auth:** native Google sign-in, one-account-per-email, account linking + CSP ([24612cc](https://github.com/VoMinhKhoii/Nham/commit/24612cc08d35c23191c1bdd365e7f246d0cbbba1))
* **auth:** nonce CSP, duplicate-email contract guards, linking UX polish ([66c26d5](https://github.com/VoMinhKhoii/Nham/commit/66c26d5d6cb5f4f2c4ee250924fab2f9f62aa54a))
* barcode scanning ([3d1d343](https://github.com/VoMinhKhoii/Nham/commit/3d1d343b5f60f70e9208cb507b416e51422e62d3))
* **meals:** share to circle by default on every meal-creation path ([c95b915](https://github.com/VoMinhKhoii/Nham/commit/c95b915fb148fd28fd2cb91f2cd8bc14c4e7bbc8))
* **meals:** share to circle by default on every meal-creation path ([3d7493d](https://github.com/VoMinhKhoii/Nham/commit/3d7493d8b75579c42634b90a017d1afaf9ae5c24))
* **mobile:** modernize dashboard & nav mobile UX ([d7d05e6](https://github.com/VoMinhKhoii/Nham/commit/d7d05e6a9e6896144b155b3b8076e864944bd3e9))
* **mobile:** modernize dashboard & nav mobile UX ([8a146a9](https://github.com/VoMinhKhoii/Nham/commit/8a146a9a73519bf25acd448dd9872af5f3328f14))
* **mobile:** switch Google sign-in to native flow ([ed86d1e](https://github.com/VoMinhKhoii/Nham/commit/ed86d1e4f03c9d399fe069a1579974367e292220))
* **nutrition:** compact suggested-foods sheet + clearer drawer hierarchy ([eb9c318](https://github.com/VoMinhKhoii/Nham/commit/eb9c3186695a82c0e76690917f29988dadddc14c))
* **nutrition:** derive food suggestions from the composition DB for any nutrient ([4f415d9](https://github.com/VoMinhKhoii/Nham/commit/4f415d9543e9208b1871e3654e95747cfb22e9a8))
* **nutrition:** filter impractical foods from candidate suggestions ([fdfb9c9](https://github.com/VoMinhKhoii/Nham/commit/fdfb9c9b20879bf69daf9626f58ca57f6f1af9d9))
* **nutrition:** mobile foods sheet — DB-derived foods, reserve + cycle ([df07081](https://github.com/VoMinhKhoii/Nham/commit/df070813db6a95f9e0c4e445ffd14e62281bcffc))
* **nutrition:** redesign mobile Nutrition tab into a single dense view ([64bdf9c](https://github.com/VoMinhKhoii/Nham/commit/64bdf9c3cb5de0aed8f73f05a101ac0455a5e35a))
* pre-launch UX overhaul (mobile/Flutter) — full audit, Waves 0–3 ([355073c](https://github.com/VoMinhKhoii/Nham/commit/355073cae195556f7e7dcbcbbde557131c2affd7))


### Bug Fixes

* address CodeRabbit review comments ([59f6405](https://github.com/VoMinhKhoii/Nham/commit/59f64059702b9739c51ea6c74e1361474eb94bc5))
* **barcode:** address CodeRabbit review comments on [#162](https://github.com/VoMinhKhoii/Nham/issues/162) ([dfc6e89](https://github.com/VoMinhKhoii/Nham/commit/dfc6e890fa11f55e03502f653370266561998e08))
* **barcode:** address review escalations (races, timeout, i18n errors) ([f7ac129](https://github.com/VoMinhKhoii/Nham/commit/f7ac12997a10886327e4306e987e4f26891799dc))
* **barcode:** second round of CodeRabbit review fixes ([80b3322](https://github.com/VoMinhKhoii/Nham/commit/80b3322911ecbb1d713257b2d7d4af35fa5f5d27))
* **ci:** interpret migration timestamps as UTC + re-date off-source migration ([d66dc02](https://github.com/VoMinhKhoii/Nham/commit/d66dc0264923a737147e444dade0ac862271d9b7))
* **dashboard-mobile:** equalize weight field and button height ([e4833dd](https://github.com/VoMinhKhoii/Nham/commit/e4833ddd2fc74b768e840ad6b60cee1b43167827))
* **db:** remove back-dated add_off_ingredient_source migration ([9ca5d7a](https://github.com/VoMinhKhoii/Nham/commit/9ca5d7ae7a56cf5f4f3f7ff4455015422cfe49f4))
* **mobile:** settle nav drawer on canceled edge-swipe ([9af7a06](https://github.com/VoMinhKhoii/Nham/commit/9af7a06b57a3eefb3cbfbfc11cee7790988ffede))
* **nutrition-mobile:** add missing vi 'one' plural for partialNote ([831cd6a](https://github.com/VoMinhKhoii/Nham/commit/831cd6af3efed5a09d558c1d3f892ca960c37627))
* **nutrition-mobile:** clamp food chip width to stop Wrap overflow ([6e14403](https://github.com/VoMinhKhoii/Nham/commit/6e1440327103b81531720eed935d65fd88fcc24c))
* **nutrition:** default to sex-neutral average targets when sex is unknown ([482ba13](https://github.com/VoMinhKhoii/Nham/commit/482ba133a0332de1f18684f585c11c5bcbbe583b))
* **nutrition:** type resolved target unit as the mg|mcg union ([638138c](https://github.com/VoMinhKhoii/Nham/commit/638138c3804dd4603077246fea694f3648652fa2))


### Refactor

* **barcode:** review-applied cleanups + a11y for scanner dialog ([34bc31e](https://github.com/VoMinhKhoii/Nham/commit/34bc31e3298a99191c76bb17aeb8392391c926c9))
* **mobile:** flatten onboarding nudge card ([e7c676a](https://github.com/VoMinhKhoii/Nham/commit/e7c676a0493d27711e8ed2af987231fb23db96a2))
* **nutrition:** drop vestigial supportsCandidates + table-drive bucket unit ([0ecba5b](https://github.com/VoMinhKhoii/Nham/commit/0ecba5b98ee4a55529147fec06ded94d3dc6a038))
* **nutrition:** model VN iron target as age-banded ([4360bca](https://github.com/VoMinhKhoii/Nham/commit/4360bca97592077a77e8e0b01191a42fb775f6fa))

## [1.4.0](https://github.com/VoMinhKhoii/Nham/compare/v1.3.0...v1.4.0) (2026-06-26)


### Features

* **app:** brand-voiced loading + error boundaries and pending-nav feedback ([7940ddc](https://github.com/VoMinhKhoii/Nham/commit/7940ddc07c6ff8fd10ba55c6bac62c447c4bc406))
* **app:** put the daily verb and the brand in the desktop rail ([d546a53](https://github.com/VoMinhKhoii/Nham/commit/d546a539d64e25c339643d122fa28ff65f500ea5))
* **auth:** collapse the dialog's triple mode-statement, lead with Google ([c17efd5](https://github.com/VoMinhKhoii/Nham/commit/c17efd536c24413770990e672a09377f753a1c99))
* **auth:** keep auth on the invite page instead of teleporting to marketing ([7e050f5](https://github.com/VoMinhKhoii/Nham/commit/7e050f5e8123f5f9eb9cc53756bea5a18cfc5fbf))
* **auth:** password recovery, persistent check-email, and inline errors ([9adbfd0](https://github.com/VoMinhKhoii/Nham/commit/9adbfd0fef6bb852b2e1ded4ffc51b5b53242e22))
* **dashboard,logging:** design the over-target state, retire the pill and trend arrows ([2f60761](https://github.com/VoMinhKhoii/Nham/commit/2f60761976d67391e92274eb819800a7fe242aa8))
* **dashboard:** stage heatmap by data age + day-0 empty card ([6b19b35](https://github.com/VoMinhKhoii/Nham/commit/6b19b35c976763c0d6840f21b7d5cec08ad37c43))
* **dashboard:** un-invert to a scrolling page with a generous Today band ([9eae371](https://github.com/VoMinhKhoii/Nham/commit/9eae371c8287ce0526defb0e58a5ef98b0599d52))
* **groups:** add "How you appear" display-name row to the invite dialog ([98d40b4](https://github.com/VoMinhKhoii/Nham/commit/98d40b4a95fa87c1f6fb68d7e542eda560883a4e))
* **groups:** seat the user at their own table + a presence strip ([588fafa](https://github.com/VoMinhKhoii/Nham/commit/588fafa7ffdc024d99c239401cff3a85274eb1c5))
* **invite:** resolve invite-accept in place, no teleport ([c373811](https://github.com/VoMinhKhoii/Nham/commit/c373811bdde4b50b9e352a35c1a359ee34b24cf0))
* **landing,nutrition:** remove all surfaced uncertainty per founder direction ([39997d1](https://github.com/VoMinhKhoii/Nham/commit/39997d12bc7a47d4199a2f43f65502e4b83fe748))
* **landing:** playable hero demo + editorial problem rebuild ([b821f41](https://github.com/VoMinhKhoii/Nham/commit/b821f414a4e2a5bf49fd683f2a10c433ee21daed))
* **landing:** real anchors, honest footer, and a true-pitch subtitle ([fd8eab7](https://github.com/VoMinhKhoii/Nham/commit/fd8eab7f1ef9171dab2512173d72bf77796e8838))
* **logging:** "fix it in words" — NL-refine a persisted meal ([ff3b7dd](https://github.com/VoMinhKhoii/Nham/commit/ff3b7dde7147a6957cada402f0dbb8700446adbd))
* **logging:** "Log again" re-logs any meal from the feed ([1987e28](https://github.com/VoMinhKhoii/Nham/commit/1987e28f3b6e502bcd72ba221d1859ee62f2e93a))
* **logging:** center manual composer, grow ingredients upward ([0c61f1e](https://github.com/VoMinhKhoii/Nham/commit/0c61f1ea949fa445b2722e7a3ee366ec7f208f2e))
* **logging:** center the composer when empty, animate to bottom on log ([bd7dfbf](https://github.com/VoMinhKhoii/Nham/commit/bd7dfbf0c2989b40f6626a299e1eea1d5a725946))
* **logging:** Cronometer-style manual logging with semantic search ([9afe1aa](https://github.com/VoMinhKhoii/Nham/commit/9afe1aa80e9249cedb58f7ce309560c5d4ac207a))
* **logging:** deterministic Cronometer-style manual logging on web ([a713e13](https://github.com/VoMinhKhoii/Nham/commit/a713e134d877350dec5e1b6feb457465e3edea58))
* **logging:** edit a persisted meal — gram steppers + per-row remove ([0691682](https://github.com/VoMinhKhoii/Nham/commit/0691682627fe50ef5607cbb3f4e426bd4f152b06))
* **logging:** flat reverse-chronological day list with sticky month dividers ([55cc9da](https://github.com/VoMinhKhoii/Nham/commit/55cc9dae70ebe39c4e24be764070de87aa11aa83))
* **logging:** make the input bar itself the centered empty state ([86349bf](https://github.com/VoMinhKhoii/Nham/commit/86349bfac11a82c70bb807e2db95d0347f4cccb9))
* **logging:** manual-log UX — save raw text, name below, dropdown upward ([10c72be](https://github.com/VoMinhKhoii/Nham/commit/10c72bebbb77ea4731c073e530a79caf20c94360))
* **logging:** remove a meal with 5-second undo ([bde22c1](https://github.com/VoMinhKhoii/Nham/commit/bde22c146b70f9a31a8581e1c30c7fb2a5169d2c))
* **mobile:** Cronometer-style manual logging sheet ([6614c8b](https://github.com/VoMinhKhoii/Nham/commit/6614c8bb204faa4dbc570bfa55b3931f0528691b))
* **nutrition:** per-day time axis on the rhythm figure ([1d9ea36](https://github.com/VoMinhKhoii/Nham/commit/1d9ea36514c2868ae9a91941af183a9e2b358406))
* **nutrition:** per-nutrient day-strips on spotlight + steady rows ([96d225e](https://github.com/VoMinhKhoii/Nham/commit/96d225e32d58429baca06a40c77383c45190e346))
* pre-launch UX overhaul (web) — full audit, Waves 0–3 ([f71388c](https://github.com/VoMinhKhoii/Nham/commit/f71388cd863be9a22e701907497150e9d974b079))
* **pwa:** brand app icons, cream manifest, and authed-home redirect ([adb9aba](https://github.com/VoMinhKhoii/Nham/commit/adb9aba8820d0ce50feda6615af1a01b4c7f55d2))
* **pwa:** mobile bottom tab bar + shell-level log action ([aabbae7](https://github.com/VoMinhKhoii/Nham/commit/aabbae735a5f369502083191045ab30b5d379424))
* **pwa:** tier-1 offline page + flag-gated service worker ([2c229bb](https://github.com/VoMinhKhoii/Nham/commit/2c229bbe4b036937e6bbdc90659fabf08afbbb32))
* **search:** semantic fallback for manual ingredient search ([94fc7e8](https://github.com/VoMinhKhoii/Nham/commit/94fc7e86c74a683e37b73af3cf9518e74e5870a6))
* **settings:** account deletion + data export with full backend ([a5c1256](https://github.com/VoMinhKhoii/Nham/commit/a5c12564128df366eb4aa5047a73e55ed593806e))
* **settings:** flatten routed tabs into one anchored page ([01a23c0](https://github.com/VoMinhKhoii/Nham/commit/01a23c0b90346a790d39db9133eb531901daea2a))
* **settings:** goal before→after ritual + consequence-aware save ([a9580ff](https://github.com/VoMinhKhoii/Nham/commit/a9580ffd1b089ee1a2926d345b26454787d72457))
* **settings:** stop fabricating body-metric defaults + add a language row ([0de3724](https://github.com/VoMinhKhoii/Nham/commit/0de37249f379dc821564dc5bebd2c6aa8279bf85))
* **ux:** one-tap NL refine, presence skeleton, offline system fonts ([57855b3](https://github.com/VoMinhKhoii/Nham/commit/57855b325e49ae8a863b05c6c9506299ff1c5c3d))


### Bug Fixes

* add missing t dependency to useCallback ([6b3e959](https://github.com/VoMinhKhoii/Nham/commit/6b3e959e8957e25bd7cbdd9ce952840a35a14039))
* address CodeRabbit review — 8 fixes across web, Flutter, and docs ([6e9059d](https://github.com/VoMinhKhoii/Nham/commit/6e9059d20aeb4fa105fa7d89ef9824533f6d86f0))
* **auth:** make auth dialog accessible (dialog role, focus trap, Escape) ([b9e05d1](https://github.com/VoMinhKhoii/Nham/commit/b9e05d1017d33b31de0443244a3e0d2c5f78bf5c))
* **dashboard:** tactical brand sweep — solid cards, localized weekdays ([f515cf8](https://github.com/VoMinhKhoii/Nham/commit/f515cf8da8b043692fbe728935304781fe8829a5))
* **i18n:** cover Vietnamese diacritics with a DM Sans sans companion ([e1132bf](https://github.com/VoMinhKhoii/Nham/commit/e1132bfcea53c51a3d17f0edc9256049910f2c28))
* **i18n:** format meal time labels with the active app locale ([e80d6ad](https://github.com/VoMinhKhoii/Nham/commit/e80d6ad02797445be3d7a7bfe01c47d21c28a3e7))
* **i18n:** use the real ellipsis character in display copy ([16b8d5f](https://github.com/VoMinhKhoii/Nham/commit/16b8d5f41f374724df5d9169efc98b2e7e4e8365))
* **landing:** load the brand fonts, restore diacritics, remove fabricated proof ([f917a39](https://github.com/VoMinhKhoii/Nham/commit/f917a396e623a46249156ee8520002723bd4c71e))
* **logging:** harden meal-card edit/log-again/manual logic; hide fix-with-words ([1863ada](https://github.com/VoMinhKhoii/Nham/commit/1863ada99bed958df7b4db66542d53a9c951cf59))
* **logging:** harden NL-refine error path, races, and length budget ([9e37d8f](https://github.com/VoMinhKhoii/Nham/commit/9e37d8ff5cbe27c2e0a676f1eddb8f6978a265e8))
* **logging:** manual composer spans full width when centered ([d7423e0](https://github.com/VoMinhKhoii/Nham/commit/d7423e04b57d9eabc52c900a5706f2e3aa042911))
* **meals:** keep share state when editing a meal's amounts ([1dd6f35](https://github.com/VoMinhKhoii/Nham/commit/1dd6f350bd43bd46414cf6ee5ae363033434e2bb))
* **nav:** redirect dead settings routes and wire 'see how it works' CTAs ([235c893](https://github.com/VoMinhKhoii/Nham/commit/235c893c12e7e29f96494f0e0bd42efd07623529))
* **pwa:** auto-submit the dashboard→logging handoff (kill the double-submit) ([5821df6](https://github.com/VoMinhKhoii/Nham/commit/5821df6d920231fadac30ac571b98077eef085a1))
* **search:** always rank-fuse with a weighted semantic arm ([9c39cb5](https://github.com/VoMinhKhoii/Nham/commit/9c39cb508b98848c5e471d968632d44b6797f087))
* **search:** de-saturate fuzzy ranking with canonical-name tie-break ([f9015bc](https://github.com/VoMinhKhoii/Nham/commit/f9015bcd2c824f30d89136f80e9ad890634a9234))
* **search:** rank manual ingredient search by word_similarity ([e2de415](https://github.com/VoMinhKhoii/Nham/commit/e2de415f1257e15147460b673209a74aa61ed1dc))
* **search:** rank-fuse manual ingredient search instead of gating semantic ([fea2258](https://github.com/VoMinhKhoii/Nham/commit/fea225809d6de5f86eb078f72f2a512276771854))
* **security:** harden auth redirects, admin client, logs, and data export ([e5ea0a3](https://github.com/VoMinhKhoii/Nham/commit/e5ea0a3d0f23bce5fd21bf234bd2957713f5d1e7))
* **ui:** hold Lora to weight 400, never heavier ([cf8ecc1](https://github.com/VoMinhKhoii/Nham/commit/cf8ecc1cf0613b76873694f10e26186f7f5a4d68))
* **ui:** re-clothe error states in warm nham-danger token ([1d44a3f](https://github.com/VoMinhKhoii/Nham/commit/1d44a3ffab8ef07e12f0f9ef5295ab3e0e82deb4))
* **ux:** minor sweep — SELECT as typing target, sentence-case labels ([288d832](https://github.com/VoMinhKhoii/Nham/commit/288d832290ec04e14cc44c7ce6edc02aa04697bc))


### Performance

* **pipeline:** hybrid RRF retrieval in one round trip per arm ([b2f62d9](https://github.com/VoMinhKhoii/Nham/commit/b2f62d91642a7f575e94911de7503da2ef6b2ff9))


### Refactor

* **app:** nest components/app into navigation/ and shell/ ([35a80ac](https://github.com/VoMinhKhoii/Nham/commit/35a80accdc8ab61e19b2648630f5c2e9c81e4168))
* **feed:** extract useMealCardActions from feed-area god component ([20be89f](https://github.com/VoMinhKhoii/Nham/commit/20be89f0c224afec3f377d78536b0591281da212))
* **feed:** nest logging/feed cards into domain subfolders ([9fc9894](https://github.com/VoMinhKhoii/Nham/commit/9fc98944d35b1c95e8eeb6f24a6036ab2f0657dc))
* **hooks:** nest hooks/ into domain groups ([299d5fe](https://github.com/VoMinhKhoii/Nham/commit/299d5fee9fbe6b70447919046699b6c82c644a71))
* **meals:** extract buildMealItemGroupsFromRows, dedupe 3 rebuild sites ([0bc676d](https://github.com/VoMinhKhoii/Nham/commit/0bc676d4d09b74e7d322ca5de4b566b662ac0227))
* **meals:** nest lib/actions/meals/ and split out the type shapes ([46ed4b9](https://github.com/VoMinhKhoii/Nham/commit/46ed4b9f15a57bd8e81ad460fa87fe9094471398))
* **nutrition:** lift DailyRhythm legend + PullQuote out of the template register ([b0ed539](https://github.com/VoMinhKhoii/Nham/commit/b0ed53984666d3aa2a64d830ea1dffda6651d651))
* **nutrition:** re-token Patterns to the brand register ([688e6ae](https://github.com/VoMinhKhoii/Nham/commit/688e6ae130ad416bd482854bbaffcbd8be876cd2))
* **pipeline:** nest lib/ai/pipeline into shadow/, telemetry/, config/ ([ac19c1b](https://github.com/VoMinhKhoii/Nham/commit/ac19c1bbc5517a2555c44f2759294365c3a53788))
* **quality:** extract useAsyncAction, decompose day-series, drop unsafe casts ([c1e13b5](https://github.com/VoMinhKhoii/Nham/commit/c1e13b52ba42057842499532c73ac2880e3980f4))
* simplify and modularize manual logging + matching changes ([052190a](https://github.com/VoMinhKhoii/Nham/commit/052190accbec35192d2879cc3c7de2f05da0e328))
* structure cleanup — folder nesting, font utilities, god-component split ([27953d9](https://github.com/VoMinhKhoii/Nham/commit/27953d9ff70f42eaeca4c2acc3cb90103b18bc78))
* **ui:** replace inline fontFamily styles with font utility classes ([8f58a29](https://github.com/VoMinhKhoii/Nham/commit/8f58a296127f985d1cba2d953320e8f59e6fefe2))

## [1.3.0](https://github.com/VoMinhKhoii/Nham/compare/v1.2.0...v1.3.0) (2026-06-10)


### Features

* **cheat:** alternating top/bottom stop labels + drinks ramp ordering ([8d61ab8](https://github.com/VoMinhKhoii/Nham/commit/8d61ab888d7b5fd4abda4aaa1780ac04d69890cd))
* **cheat:** cheat-meal logging via interpretable sliders ([65967c0](https://github.com/VoMinhKhoii/Nham/commit/65967c05870eed272e4a2e796bec304e2cf45e44))
* **cheat:** mode picker + Light/Medium/Heavy intensity; drop rationale + connector ([148cc58](https://github.com/VoMinhKhoii/Nham/commit/148cc5837565e96f60caabc2f44fe1dd292b2219))
* **dashboard:** per-day calorie progress ring on the mobile week strip ([ac73108](https://github.com/VoMinhKhoii/Nham/commit/ac73108a6656ca96309bfe06cc873d6733b7755a))
* **mobile-flutter:** add Flutter 1:1 port of the mobile app ([7723110](https://github.com/VoMinhKhoii/Nham/commit/772311008df814f6f2abcf2931d6419521828915))
* **mobile-flutter:** dashboard header greeting, week strip, card alignment ([5a449f0](https://github.com/VoMinhKhoii/Nham/commit/5a449f090c2b1a8a00b19fe2a21f5294048f844b))
* **mobile-flutter:** dashboard surface polish (round 2) ([b9bc9ab](https://github.com/VoMinhKhoii/Nham/commit/b9bc9ab13bea6ced59ae29e2652bf1cc000f7e78))
* **mobile-flutter:** force first-run onboarding + dual presentation + setup interstitial ([7d94c3a](https://github.com/VoMinhKhoii/Nham/commit/7d94c3a7fa0f38a43e73fad42b1c3539a7b0777b))
* **mobile-flutter:** onboarding polish (daily-target card, flags, transitions) ([9515c3f](https://github.com/VoMinhKhoii/Nham/commit/9515c3fe0e894eab1854f33a29554b9cea1f77f3))
* **mobile-flutter:** redesign dashboard — flat, high-contrast system ([d7f8465](https://github.com/VoMinhKhoii/Nham/commit/d7f8465abcd1fe0584fd67826f0a63706dd51bd4))


### Bug Fixes

* **cheat:** address CodeRabbit review on [#152](https://github.com/VoMinhKhoii/Nham/issues/152) ([9adb7d0](https://github.com/VoMinhKhoii/Nham/commit/9adb7d0be56587e2559ad1f893e428b961ada7f7))
* **cheat:** polish slider card + mode picker UI ([b84c46c](https://github.com/VoMinhKhoii/Nham/commit/b84c46ce1b39e548687cc79c709269cb38c6ae76))
* **cheat:** preserve in-progress slider levels across background refetch ([8927360](https://github.com/VoMinhKhoii/Nham/commit/89273603daa37941130099e35cefcb8e344c3f4e))
* **cheat:** stop right-edge label collapse + move Save outside the card ([78296ef](https://github.com/VoMinhKhoii/Nham/commit/78296efc4114cba76885710f62bbc245509f3893))
* **cheat:** widen slider scenario labels instead of title readout ([476e07a](https://github.com/VoMinhKhoii/Nham/commit/476e07a5284945e26d7fca63b5b45a6aec8f4c10))
* **ci:** make biome lint pass on feat/mobile-flutter ([3fe620b](https://github.com/VoMinhKhoii/Nham/commit/3fe620b0b90c459a331229e5f423e588f821504e))
* **dashboard:** apply pre-PR review auto-fixes ([96d2b33](https://github.com/VoMinhKhoii/Nham/commit/96d2b3389527a054e126627418b254603f42a95d))
* **db:** regenerate cheat snapshot on the group-tracking baseline ([3c2cbc0](https://github.com/VoMinhKhoii/Nham/commit/3c2cbc0c55dd39941ba2af8020aae6e898d620bc))
* **logging:** harden confirm reconciliation per pre-PR review ([ce39e46](https://github.com/VoMinhKhoii/Nham/commit/ce39e469808d334e4d82ba9aad82a2b938cd5eee))
* **logging:** keep calorie ring synced after saving the first meal ([723da40](https://github.com/VoMinhKhoii/Nham/commit/723da40a39a32e90282db446d79a5e87320c4f90))
* **logging:** refresh dashboard ring after save + add save-meal e2e coverage ([125814a](https://github.com/VoMinhKhoii/Nham/commit/125814af1d67cad5f6227512f6a0cfc3bc367301))
* **meals:** move PersistedMeal builders out of the 'use server' module ([a02bed9](https://github.com/VoMinhKhoii/Nham/commit/a02bed926d9afaa87ce9f03c7fac48b82ef5ada3))
* **mobile-flutter:** refresh dashboard after logging a meal ([c150235](https://github.com/VoMinhKhoii/Nham/commit/c1502359c3bd3cd2a6c2f76f55c16a4b915dffaf))
* **mobile-flutter:** repair auth flow + register OAuth deep link ([6d84f02](https://github.com/VoMinhKhoii/Nham/commit/6d84f02fefe150fac21d07b4f3fede621d8724ac))
* **mobile-flutter:** repair fastlane beta lane for Ruby 4.0 / fastlane 2.235 ([feadfd5](https://github.com/VoMinhKhoii/Nham/commit/feadfd5303f59ef9ad7f5ac9756211438301133f))
* **mobile-flutter:** surface analyze stalls + confirm failures ([4be6e77](https://github.com/VoMinhKhoii/Nham/commit/4be6e776c6ffd55c108a7fcdcaaf9e81f9a129c6))


### Performance

* **api:** memoize auth per request + harden confirm cache writes ([6073399](https://github.com/VoMinhKhoii/Nham/commit/60733994519df06d1a10b2c96450e177660517ba))
* **logging:** reconcile saved meal from confirm response, drop day refetch ([fdc8fcb](https://github.com/VoMinhKhoii/Nham/commit/fdc8fcba1a8474cc25ef7ec0a32acebf68820685))


### Refactor

* **cheat:** share macro-color constant + fix stop-label contrast ([db95d74](https://github.com/VoMinhKhoii/Nham/commit/db95d743200d8871641ab5334aa871c76b8d9514))
* **logging:** extract shared upsertById cache helper ([bd0f184](https://github.com/VoMinhKhoii/Nham/commit/bd0f184ced45d4456d3eac9533d023f94d69362f))
* **meals:** pre-generate ingredient ids instead of relying on RETURNING order ([4f3f5f5](https://github.com/VoMinhKhoii/Nham/commit/4f3f5f58f380a6c345f85af3257354bfd4203e97))
* **meals:** share PersistedMeal builders across save and load paths ([5620951](https://github.com/VoMinhKhoii/Nham/commit/5620951dc730693bb3e3c46851c7c894d9ff64d3))


### Documentation

* **agents:** point mobile work at apps/docs/mobile + add doc-upkeep rule ([d822cdd](https://github.com/VoMinhKhoii/Nham/commit/d822cdd546235078055839155bfd4737c4939f17))
* **mobile:** add apps/docs/mobile (development, releasing, architecture) ([7a5a0c3](https://github.com/VoMinhKhoii/Nham/commit/7a5a0c358bc6bc96006b0240edf975146c2682e6))

## [1.2.0](https://github.com/VoMinhKhoii/Nham/compare/v1.1.0...v1.2.0) (2026-06-02)


### Features

* **api:** add /api/v1 REST surface with Bearer auth for mobile ([47dd6ab](https://github.com/VoMinhKhoii/Nham/commit/47dd6abc9060aec2fcd4acabae49b0a79555fb84))
* **api:** add aggregate GET /api/v1/dashboard endpoint ([53ea8e3](https://github.com/VoMinhKhoii/Nham/commit/53ea8e33b759f88776dbf30920def70008a7daa0))
* **auth:** thread invite return-path through sign-in/up and OAuth ([5b1b0d0](https://github.com/VoMinhKhoii/Nham/commit/5b1b0d048d1d74628c6035ebf037883631112af6))
* **groups:** add /api/v1/groups REST API, services, and hooks ([c91e3b6](https://github.com/VoMinhKhoii/Nham/commit/c91e3b6d4438653a3612a608b0dd7990748b2165))
* **groups:** add Circle social data model, RLS, and isolation tests ([f33b1e1](https://github.com/VoMinhKhoii/Nham/commit/f33b1e12e714afc727b08da38d040141f9b6cf1b))
* **groups:** add Circle wall, add-friend, and post-save share toggle UI ([cb890fe](https://github.com/VoMinhKhoii/Nham/commit/cb890fe9673a2bf0cb2f6a1cc9cc632979b1df63))
* **groups:** add claim-handle flow and a functional invite link ([782ed37](https://github.com/VoMinhKhoii/Nham/commit/782ed37ec91b207a8c16d76f6670873a55ebe258))
* **groups:** add Macro Card OG image and native share ([d5342fe](https://github.com/VoMinhKhoii/Nham/commit/d5342fe3942d1a6e19833237038a5e539cf56608))
* **groups:** add skeleton loading to the circle wall ([7cd3dc4](https://github.com/VoMinhKhoii/Nham/commit/7cd3dc482e603bad2b342e4de155d740d1c8af9d))
* **groups:** Circle social layer — opt-in meal sharing, friends, Macro Card ([f927f78](https://github.com/VoMinhKhoii/Nham/commit/f927f78738d89f97c32f0503ac555dabd02e248c))
* **groups:** replace handle search with Locket-style link invites ([a5a107f](https://github.com/VoMinhKhoii/Nham/commit/a5a107fdf9af2e7bd04ff7ad682386c1a8870e46))
* **groups:** scope the handle directory behind RLS + exact-match RPC ([d06badd](https://github.com/VoMinhKhoii/Nham/commit/d06baddd45a43553dfebc9f6542125abae8a91dc))
* **mobile:** dashboard + weight surface (Phase 4) ([9ee7aac](https://github.com/VoMinhKhoii/Nham/commit/9ee7aac6049a5ba6ef738cb26ae419444a978602))
* **mobile:** dashboard aggregate fetch, perf fixes, folder reorg ([9308a83](https://github.com/VoMinhKhoii/Nham/commit/9308a83c60a333a89c60f491a383a139695cf4a5))
* **mobile:** design-system foundation (tokens, fonts, primitives) ([eb6544b](https://github.com/VoMinhKhoii/Nham/commit/eb6544b274430f86978743f4fe95d6b2542c5c5f))
* **mobile:** i18n-migrate auth, logging, and today-section strings ([5e7d47e](https://github.com/VoMinhKhoii/Nham/commit/5e7d47edb71dbcc272f021443a8a808f5f4d04ff))
* **mobile:** logging date chip + date selection + meal-card fidelity ([c877ad9](https://github.com/VoMinhKhoii/Nham/commit/c877ad96ceefe788f5ab8afc6e9e7feca0b05e40))
* **mobile:** logging wedge — streaming meal analysis, feed, confirm ([87972ce](https://github.com/VoMinhKhoii/Nham/commit/87972ce731e500d8406ecab262db0dc348005ec8))
* **mobile:** match logging UI 1:1 to web mobile view ([237a065](https://github.com/VoMinhKhoii/Nham/commit/237a065330c5efb41b8e6b1449090d2ff3874342))
* **mobile:** Phase 6 — observability, locale-from-profile, warmup, EAS config ([804833f](https://github.com/VoMinhKhoii/Nham/commit/804833fc6a5e496897a8026053314ae09729baf7))
* **mobile:** port nutrition screen 1:1 from web (Phase 5a) ([ee53abc](https://github.com/VoMinhKhoii/Nham/commit/ee53abc9c54668534b66c056ede8f29a5a9d25fb))
* **mobile:** port onboarding wizard 1:1 from web (Phase 5c) ([857c73c](https://github.com/VoMinhKhoii/Nham/commit/857c73c74f9bcdaa51e61db1ea61d827e1b61c7b))
* **mobile:** port settings (profile) screen 1:1 from web (Phase 5b) ([b553f45](https://github.com/VoMinhKhoii/Nham/commit/b553f4593f18e72d3a68d1a0a3c0d82facd5a0f6))
* **mobile:** re-port weight card + 90d heatmap 1:1 from web ([2d824b1](https://github.com/VoMinhKhoii/Nham/commit/2d824b122d34a5f815936440c4108634cf70f710))
* **mobile:** React Native/Expo app + /api/v1 REST surface ([d816b29](https://github.com/VoMinhKhoii/Nham/commit/d816b29521adb7aeba9a0c0f6fd5467961226be1))
* **mobile:** replace bottom tabs with hamburger + drawer sidebar ([77539f8](https://github.com/VoMinhKhoii/Nham/commit/77539f86631f2a3a012d48dca8744519c79dfada))
* **mobile:** scaffold Expo app with Supabase auth + REST client ([95a145e](https://github.com/VoMinhKhoii/Nham/commit/95a145e5f3fec0f002edf0910e98b8dc4f42bac7))
* **mobile:** wire i18n via use-intl + shared message catalogs ([e414479](https://github.com/VoMinhKhoii/Nham/commit/e414479edcb67f231bf013697eff536824503382))
* under-logged day handling, logging warnings, and settings rework ([e8feacc](https://github.com/VoMinhKhoii/Nham/commit/e8feacc209b6284e79555fef6767eb24ce8a3b74))


### Bug Fixes

* **dashboard:** prevent crash when weight input has a numeric default ([4fd722b](https://github.com/VoMinhKhoii/Nham/commit/4fd722be73461e9335d93bcdcd082e51c8c85063))
* **dashboard:** prevent crash when weight input has a numeric default ([10f6f18](https://github.com/VoMinhKhoii/Nham/commit/10f6f18e304b33a363a65601186e505251c0f819))
* **groups:** add retryable error states and clearer auth/empty copy ([33bb9e3](https://github.com/VoMinhKhoii/Nham/commit/33bb9e304bf20d221b6e4aaa59f64f0c2080b084))
* **groups:** address CodeRabbit review on the Circle layer ([d096592](https://github.com/VoMinhKhoii/Nham/commit/d0965923509516db44bc480d6014af2d46364be1))
* **groups:** drop the @ prefix from circle labels ([79e0bdf](https://github.com/VoMinhKhoii/Nham/commit/79e0bdf1cb8bf2a0d402f23daec35600453c9b0f))
* **groups:** harden acceptInvite, normalize ids, fan out re-shares ([f30a1f4](https://github.com/VoMinhKhoii/Nham/commit/f30a1f4dce42e82a0193bbcbb797e9b3c4c4d8ed))
* **groups:** render the Macro Card (Satori display:flex on multi-child node) ([76cba9e](https://github.com/VoMinhKhoii/Nham/commit/76cba9ed86302deba913c97e6d95d83ad936e626))
* **groups:** seed the share toggle from real server state ([5eaf7f8](https://github.com/VoMinhKhoii/Nham/commit/5eaf7f8297db3565c005b4f9bb4b9f9ca557f46d))
* **groups:** tighten feed cache key, handle constant, RLS doc, request toast ([4dce2a6](https://github.com/VoMinhKhoii/Nham/commit/4dce2a6a9cec523b5dd8250b8878a18287865973))
* **logging:** confirm server-loaded pending meals and survive malformed rows ([d700dd9](https://github.com/VoMinhKhoii/Nham/commit/d700dd9906afdc2ae777af592026fcd53281c723))
* **logging:** confirm server-loaded pending meals and survive malformed rows ([0912056](https://github.com/VoMinhKhoii/Nham/commit/0912056a433bc9ad5015be39257cce22e8bff55a))
* **logging:** guard double-submit and clarify optimistic seed comment ([ae4390e](https://github.com/VoMinhKhoii/Nham/commit/ae4390e7181e86dff343075bf3668475fbbbba4e))
* **logging:** keep calorie ring in sync after saving the first meal ([0d3c72e](https://github.com/VoMinhKhoii/Nham/commit/0d3c72eaca98196fec8e8519c4b9e8ae072aeffa))
* **mobile:** address CodeRabbit review findings on [#139](https://github.com/VoMinhKhoii/Nham/issues/139) ([f5080e6](https://github.com/VoMinhKhoii/Nham/commit/f5080e683b60615b95f3052add972876749d3343))
* **mobile:** full-width timeline strip on expand + input clears home indicator ([98d0dc1](https://github.com/VoMinhKhoii/Nham/commit/98d0dc11729e98868051386098d8ec22e6b1130d))
* **mobile:** interaction + sizing fidelity pass across nutrition/dashboard/logging ([0aed0f9](https://github.com/VoMinhKhoii/Nham/commit/0aed0f965a6f9ef2aa3666c337ae74bdf81211a4))
* **mobile:** route to /logging after email sign-in ([0a3ec2c](https://github.com/VoMinhKhoii/Nham/commit/0a3ec2c760eaded972b096683fd56b15c6e199f6))
* **mobile:** tap-outside collapses the expanded timeline strip ([5b58fba](https://github.com/VoMinhKhoii/Nham/commit/5b58fba766f569b783bc09cefddf41d58551a39d))
* **mobile:** use explicit insets for timeline collapse scrim (RN 0.85 lacks StyleSheet.absoluteFillObject typing) ([dfed72b](https://github.com/VoMinhKhoii/Nham/commit/dfed72bbc5803f0110312cedf89da3b87611c10b))


### Performance

* **groups:** index friendship reverse lookups and the meal-share feed scan ([0522b2b](https://github.com/VoMinhKhoii/Nham/commit/0522b2b3a9e851f5d1288a802dc4a6e092a29fd0))


### Refactor

* **groups:** extract shared readJsonBody route helper ([0422549](https://github.com/VoMinhKhoii/Nham/commit/0422549758b3bbb9d7cbe44949cb10ef5da18ca1))
* **groups:** share readJsonBody and safeNextPath helpers ([775d03d](https://github.com/VoMinhKhoii/Nham/commit/775d03d215c435eb2842fb61869d240b0ba76316))


### Documentation

* **agents:** record Satori OG gotchas and the link-invite decision ([acf89f4](https://github.com/VoMinhKhoii/Nham/commit/acf89f450d562a415ba3a1fcaedda0f393d43357))
* **agents:** require /nham-design for any UI or design work ([c7b7d87](https://github.com/VoMinhKhoii/Nham/commit/c7b7d87cbe01c84194c25b5d39f767efee12aaa2))
* **groups:** add decision record and build plan ([16680c6](https://github.com/VoMinhKhoii/Nham/commit/16680c63bc99620610298896084164d878ba0661))
* **mobile:** add verified React Native / Expo port plan ([992d9c2](https://github.com/VoMinhKhoii/Nham/commit/992d9c2667d3724fa86a5b7246b4377e8d39688f))

## [1.1.0](https://github.com/VoMinhKhoii/Nham/compare/v1.0.1...v1.1.0) (2026-05-27)


### Features

* **log:** demote Confirm to ghost style while editing + debounce taps ([ef27782](https://github.com/VoMinhKhoii/Nham/commit/ef277827e732f154d6c171a25e3c3d2a3506be59))
* **log:** mobile layout & typography fixes ([#123](https://github.com/VoMinhKhoii/Nham/issues/123)) ([51c5480](https://github.com/VoMinhKhoii/Nham/commit/51c54807ed47c5db09c890a50d59553dc55c80b0))
* **nutrition:** exclude under-logged days from long-span metrics ([68bc85a](https://github.com/VoMinhKhoii/Nham/commit/68bc85a1726096f15985b8d8f03061d0dbb8c06b))
* **settings:** tabbed profile sections, two-level nav, clearer targets ([fc51b1f](https://github.com/VoMinhKhoii/Nham/commit/fc51b1f928427d19920b99ceac32428cc7f0111c))


### Bug Fixes

* accept comma decimal input on iOS and validate body metrics ([c517702](https://github.com/VoMinhKhoii/Nham/commit/c517702954708c1caca5f184e61f8af12d137bd5))
* **auth:** persist iOS home-screen sessions ([#121](https://github.com/VoMinhKhoii/Nham/issues/121)) ([b8d0d8b](https://github.com/VoMinhKhoii/Nham/commit/b8d0d8ba7737f19681a4d0f4741f884df245bf67))
* **ci:** disable Biome formatter for package.json ([#118](https://github.com/VoMinhKhoii/Nham/issues/118)) ([8da8c9a](https://github.com/VoMinhKhoii/Nham/commit/8da8c9af93b083a93401ad2159cadfea28fe88f3))
* **ci:** match biome 2.4.2 formatter for app/globals.css ([10c26d8](https://github.com/VoMinhKhoii/Nham/commit/10c26d8941e9cf4d438142634ea78a427a4ad87e))
* **dashboard:** render and polish the weight trend chart ([#124](https://github.com/VoMinhKhoii/Nham/issues/124)) ([f1c2988](https://github.com/VoMinhKhoii/Nham/commit/f1c298883bc680e2d1d6805bafc80322f1aecf1b))
* **deps:** patch security advisories and sync bun.lock ([cc90d11](https://github.com/VoMinhKhoii/Nham/commit/cc90d113c2c08c12fad195f14c31720513641781))
* **log:** enforce MIN_DISH_GRAMS floor in applyQuantityChange for g/ml ([96e9cc9](https://github.com/VoMinhKhoii/Nham/commit/96e9cc904c54fc4b8dccdab2680df5851ad2eb65))
* **log:** keep one stable key for saved meal card to kill the re-fade ([5f77171](https://github.com/VoMinhKhoii/Nham/commit/5f77171fdc604c5adb4fc01a2090e997d6f78111))
* **log:** persist meal card edits and drop the extra save step ([a280049](https://github.com/VoMinhKhoii/Nham/commit/a2800498a289647b48dbc6c291c456ffe3d5e02d))
* **log:** reflect edited quantities in optimistic meal card ([c01b52f](https://github.com/VoMinhKhoii/Nham/commit/c01b52f15df5c10b5fd1c5c8d26b645986de3bb5))
* **log:** stop saved meal card from re-fading after confirm ([9e5fce8](https://github.com/VoMinhKhoii/Nham/commit/9e5fce8d7410de5960fdde4177c9e5515cb62781))
* **mobile:** scope zoom-prevention rule to text-entry inputs ([6a1b5da](https://github.com/VoMinhKhoii/Nham/commit/6a1b5dac4fa8b076bf385a8df7476f49faad526f))
* **mobile:** stop input focus auto-zoom on iOS/Android ([e83020b](https://github.com/VoMinhKhoii/Nham/commit/e83020be0a68093d3c7ddc2a0011e303195749a0))
* **settings:** address pre-PR review — a11y, validation gate, contrast ([797fc9f](https://github.com/VoMinhKhoii/Nham/commit/797fc9fdecb7094a3d09ea0210a5f8ba52ab0f6b))
* **settings:** give medium/small screens room to breathe ([4de1126](https://github.com/VoMinhKhoii/Nham/commit/4de1126c21e8a4a0325d80d753c2d5842fe59d57))
* **settings:** stop horizontal overflow, pin save bar, polish nav + mobile ([55ae6c9](https://github.com/VoMinhKhoii/Nham/commit/55ae6c968e9e28bd76d7e08346cc87a66f61418e))


### Performance

* **ai:** cut v2 matching latency from 13-15s to ~2-3s warm ([#120](https://github.com/VoMinhKhoii/Nham/issues/120)) ([0256bf3](https://github.com/VoMinhKhoii/Nham/commit/0256bf3a705c0a7228ec033e07ec5f84f71f72ec))
* **ai:** pre-warm matching caches at boot + phase timings ([#122](https://github.com/VoMinhKhoii/Nham/issues/122)) ([c346f0d](https://github.com/VoMinhKhoii/Nham/commit/c346f0ddb1dd7b8056c54b30faee302f3a166eb2))


### Refactor

* **log:** address pre-PR review findings on meal-card edit ([c8c374d](https://github.com/VoMinhKhoii/Nham/commit/c8c374d69483800f771dae805790149adc27c998))


### Documentation

* **agents:** add release-please version bumping rule of thumb ([#115](https://github.com/VoMinhKhoii/Nham/issues/115)) ([14b051f](https://github.com/VoMinhKhoii/Nham/commit/14b051f927d9125d6dea7752e1510a3b90a12df9))

## [1.0.1](https://github.com/VoMinhKhoii/Nham/compare/v1.0.0...v1.0.1) (2026-05-21)


### Bug Fixes

* **ci:** restore single-line array formatting in package.json ([#116](https://github.com/VoMinhKhoii/Nham/issues/116)) ([2d0a37c](https://github.com/VoMinhKhoii/Nham/commit/2d0a37cc8cae196c864e1f35551fcf3140140f76))

## 1.0.0 (2026-05-21)


### Features

* **ai:** honor user-typed weight basis and prep modifiers in macros ([04be548](https://github.com/VoMinhKhoii/Nham/commit/04be5489d7b09bceb96445a744d9a1f9996e4e55))
* **ai:** make v2 default, fix streaming buffer, capitalize names, wire pipeline_runs ([4bce450](https://github.com/VoMinhKhoii/Nham/commit/4bce450951bf03023360f89fd388a84104387cae))
* **ai:** pipeline v2 — pure-decompose Call 1 + CRAG-grounded Call 2 ([7aa67a9](https://github.com/VoMinhKhoii/Nham/commit/7aa67a9d3219c121fbe2a1df040cbb6e53ebfb15))
* **ai:** scaffold pipeline v2 (pure decompose + grounded estimation + CRAG) ([3da1790](https://github.com/VoMinhKhoii/Nham/commit/3da179056486f52d44c5668f854486ab17b78593))
* **ai:** v2 incremental streaming + slim Call 1 user_context + dispatch log ([5c030e0](https://github.com/VoMinhKhoii/Nham/commit/5c030e0627f882d1bdeb19652189e656af29bae4))
* **ai:** v2 stage logs + language guard + chunk-count probe (parity with v1) ([602709c](https://github.com/VoMinhKhoii/Nham/commit/602709cb79753ba59e3fb165339c734bb550d5ae))
* **ai:** wire v2 pipeline (top-K matching, CRAG bridge, orchestrator dispatch) ([eeb13ee](https://github.com/VoMinhKhoii/Nham/commit/eeb13ee3fec76005fe0866256dc3dec463ca3d4c))


### Bug Fixes

* address CodeRabbit review comments on PR [#112](https://github.com/VoMinhKhoii/Nham/issues/112) ([893a6c3](https://github.com/VoMinhKhoii/Nham/commit/893a6c310761646e49c81978c8295837f989480c))
* **ai:** post-review hardening + drop v2- prefix + admin pipeline-version badge ([eb94c6a](https://github.com/VoMinhKhoii/Nham/commit/eb94c6af50b3a910485828bc5e7b5d67a817ace2))
* correct contact email in LICENSE and SECURITY ([91ac6d1](https://github.com/VoMinhKhoii/Nham/commit/91ac6d199a2197ed2b4c10c2c12e3779636ab9b0))


### Documentation

* **agents:** add branch naming convention (type/short-slug) ([5b8550a](https://github.com/VoMinhKhoii/Nham/commit/5b8550aad39ca921a7faa38940ad894d427cc024))

## Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is maintained automatically by [release-please](https://github.com/googleapis/release-please).
New entries are generated from [Conventional Commit](https://www.conventionalcommits.org/) messages on `main`.
