/** Every food page's meals and copy, by slug: one file per page under `foods/<group>/`. */

import { food as bibimbap } from './foods/asian/bibimbap';
import { food as chickenFriedRice } from './foods/asian/chicken-fried-rice';
import { food as chickenStirFry } from './foods/asian/chicken-stir-fry';
import { food as chickenTeriyaki } from './foods/asian/chicken-teriyaki';
import { food as orangeChicken } from './foods/asian/orange-chicken';
import { food as padThai } from './foods/asian/pad-thai';
import { food as pho } from './foods/asian/pho';
import { food as pokeBowl } from './foods/asian/poke-bowl';
import { food as ramen } from './foods/asian/ramen';
import { food as sushiRolls } from './foods/asian/sushi-rolls';
import { food as acaiBowl } from './foods/breakfast/acai-bowl';
import { food as avocadoToast } from './foods/breakfast/avocado-toast';
import { food as bagelWithCreamCheese } from './foods/breakfast/bagel-with-cream-cheese';
import { food as breakfastBurrito } from './foods/breakfast/breakfast-burrito';
import { food as eggsBenedict } from './foods/breakfast/eggs-benedict';
import { food as frenchToast } from './foods/breakfast/french-toast';
import { food as fullEnglishBreakfast } from './foods/breakfast/full-english-breakfast';
import { food as greekYogurtParfait } from './foods/breakfast/greek-yogurt-parfait';
import { food as oatmeal } from './foods/breakfast/oatmeal';
import { food as pancakes } from './foods/breakfast/pancakes';
import { food as banhCuon } from './foods/bun-cuon/banh-cuon';
import { food as banhXeo } from './foods/bun-cuon/banh-xeo';
import { food as bunCha } from './foods/bun-cuon/bun-cha';
import { food as bunDauMamTom } from './foods/bun-cuon/bun-dau-mam-tom';
import { food as bunThitNuong } from './foods/bun-cuon/bun-thit-nuong';
import { food as banhBao } from './foods/com-tam-banh-mi/banh-bao';
import { food as banhMiThit } from './foods/com-tam-banh-mi/banh-mi-thit';
import { food as comTamSuon } from './foods/com-tam-banh-mi/com-tam-suon';
import { food as xoi } from './foods/com-tam-banh-mi/xoi';
import { food as chickenAndRice } from './foods/comfort/chicken-and-rice';
import { food as chickenNoodleSoup } from './foods/comfort/chicken-noodle-soup';
import { food as chickenWings } from './foods/comfort/chicken-wings';
import { food as fishAndChips } from './foods/comfort/fish-and-chips';
import { food as friedChicken } from './foods/comfort/fried-chicken';
import { food as butterChicken } from './foods/curries/butter-chicken';
import { food as chickenTikkaMasala } from './foods/curries/chicken-tikka-masala';
import { food as chiliConCarne } from './foods/curries/chili-con-carne';
import { food as thaiGreenCurry } from './foods/curries/thai-green-curry';
import { food as caPheSuaDa } from './foods/do-uong/ca-phe-sua-da';
import { food as traSuaTranChau } from './foods/do-uong/tra-sua-tran-chau';
import { food as beefTacos } from './foods/mexican/beef-tacos';
import { food as chickenBurrito } from './foods/mexican/chicken-burrito';
import { food as chickenQuesadilla } from './foods/mexican/chicken-quesadilla';
import { food as nachos } from './foods/mexican/nachos';
import { food as bunBoHue } from './foods/mon-nuoc/bun-bo-hue';
import { food as bunRieu } from './foods/mon-nuoc/bun-rieu';
import { food as chaoLong } from './foods/mon-nuoc/chao-long';
import { food as huTieu } from './foods/mon-nuoc/hu-tieu';
import { food as miQuang } from './foods/mon-nuoc/mi-quang';
import { food as phoBo } from './foods/mon-nuoc/pho-bo';
import { food as caKhoTo } from './foods/nau-o-nha/ca-kho-to';
import { food as canhChua } from './foods/nau-o-nha/canh-chua';
import { food as comChien } from './foods/nau-o-nha/com-chien';
import { food as dauPhuSotCaChua } from './foods/nau-o-nha/dau-phu-sot-ca-chua';
import { food as gaRangGung } from './foods/nau-o-nha/ga-rang-gung';
import { food as miGoi } from './foods/nau-o-nha/mi-goi';
import { food as rauMuongXaoToi } from './foods/nau-o-nha/rau-muong-xao-toi';
import { food as thitKhoTrung } from './foods/nau-o-nha/thit-kho-trung';
import { food as chickenAlfredo } from './foods/pizza-pasta/chicken-alfredo';
import { food as lasagna } from './foods/pizza-pasta/lasagna';
import { food as macAndCheese } from './foods/pizza-pasta/mac-and-cheese';
import { food as margheritaPizza } from './foods/pizza-pasta/margherita-pizza';
import { food as pepperoniPizza } from './foods/pizza-pasta/pepperoni-pizza';
import { food as spaghettiBolognese } from './foods/pizza-pasta/spaghetti-bolognese';
import { food as spaghettiCarbonara } from './foods/pizza-pasta/spaghetti-carbonara';
import { food as chickenCaesarSalad } from './foods/salads/chicken-caesar-salad';
import { food as cobbSalad } from './foods/salads/cobb-salad';
import { food as greekSalad } from './foods/salads/greek-salad';
import { food as cheeseburger } from './foods/sandwiches/cheeseburger';
import { food as chickenShawarma } from './foods/sandwiches/chicken-shawarma';
import { food as clubSandwich } from './foods/sandwiches/club-sandwich';
import { food as falafelWrap } from './foods/sandwiches/falafel-wrap';
import { food as friedChickenSandwich } from './foods/sandwiches/fried-chicken-sandwich';
import { food as gyro } from './foods/sandwiches/gyro';
import { food as hotDog } from './foods/sandwiches/hot-dog';
import type { FoodSlug } from './slugs';
import type { FoodContent } from './types';

export const FOODS: Record<FoodSlug, FoodContent> = {
  'avocado-toast': avocadoToast,
  'eggs-benedict': eggsBenedict,
  pancakes: pancakes,
  'breakfast-burrito': breakfastBurrito,
  oatmeal: oatmeal,
  'acai-bowl': acaiBowl,
  'greek-yogurt-parfait': greekYogurtParfait,
  'french-toast': frenchToast,
  'bagel-with-cream-cheese': bagelWithCreamCheese,
  'full-english-breakfast': fullEnglishBreakfast,
  'chicken-shawarma': chickenShawarma,
  cheeseburger: cheeseburger,
  'fried-chicken-sandwich': friedChickenSandwich,
  'club-sandwich': clubSandwich,
  'hot-dog': hotDog,
  gyro: gyro,
  'falafel-wrap': falafelWrap,
  'chicken-burrito': chickenBurrito,
  'beef-tacos': beefTacos,
  'chicken-quesadilla': chickenQuesadilla,
  nachos: nachos,
  'spaghetti-bolognese': spaghettiBolognese,
  'pepperoni-pizza': pepperoniPizza,
  'margherita-pizza': margheritaPizza,
  'spaghetti-carbonara': spaghettiCarbonara,
  'chicken-alfredo': chickenAlfredo,
  lasagna: lasagna,
  'mac-and-cheese': macAndCheese,
  'poke-bowl': pokeBowl,
  'pad-thai': padThai,
  'sushi-rolls': sushiRolls,
  ramen: ramen,
  pho: pho,
  'chicken-fried-rice': chickenFriedRice,
  'chicken-stir-fry': chickenStirFry,
  bibimbap: bibimbap,
  'chicken-teriyaki': chickenTeriyaki,
  'orange-chicken': orangeChicken,
  'chicken-tikka-masala': chickenTikkaMasala,
  'butter-chicken': butterChicken,
  'thai-green-curry': thaiGreenCurry,
  'chili-con-carne': chiliConCarne,
  'chicken-caesar-salad': chickenCaesarSalad,
  'greek-salad': greekSalad,
  'cobb-salad': cobbSalad,
  'fish-and-chips': fishAndChips,
  'chicken-wings': chickenWings,
  'fried-chicken': friedChicken,
  'chicken-and-rice': chickenAndRice,
  'chicken-noodle-soup': chickenNoodleSoup,
  'pho-bo': phoBo,
  'bun-bo-hue': bunBoHue,
  'bun-rieu': bunRieu,
  'hu-tieu': huTieu,
  'mi-quang': miQuang,
  'chao-long': chaoLong,
  'bun-cha': bunCha,
  'bun-thit-nuong': bunThitNuong,
  'banh-cuon': banhCuon,
  'banh-xeo': banhXeo,
  'bun-dau-mam-tom': bunDauMamTom,
  'com-tam-suon': comTamSuon,
  'banh-mi-thit': banhMiThit,
  xoi: xoi,
  'banh-bao': banhBao,
  'tra-sua-tran-chau': traSuaTranChau,
  'ca-phe-sua-da': caPheSuaDa,
  'thit-kho-trung': thitKhoTrung,
  'ca-kho-to': caKhoTo,
  'canh-chua': canhChua,
  'rau-muong-xao-toi': rauMuongXaoToi,
  'dau-phu-sot-ca-chua': dauPhuSotCaChua,
  'ga-rang-gung': gaRangGung,
  'com-chien': comChien,
  'mi-goi': miGoi,
};
