/** Every food page's captured numbers, written by `scripts/seo/capture-food-page.ts` to `captures/<slug>.json`. */

import acaiBowl from './captures/acai-bowl.json';
import avocadoToast from './captures/avocado-toast.json';
import bagelWithCreamCheese from './captures/bagel-with-cream-cheese.json';
import beefTacos from './captures/beef-tacos.json';
import bibimbap from './captures/bibimbap.json';
import breakfastBurrito from './captures/breakfast-burrito.json';
import butterChicken from './captures/butter-chicken.json';
import cheeseburger from './captures/cheeseburger.json';
import chickenAlfredo from './captures/chicken-alfredo.json';
import chickenAndRice from './captures/chicken-and-rice.json';
import chickenBurrito from './captures/chicken-burrito.json';
import chickenCaesarSalad from './captures/chicken-caesar-salad.json';
import chickenFriedRice from './captures/chicken-fried-rice.json';
import chickenNoodleSoup from './captures/chicken-noodle-soup.json';
import chickenQuesadilla from './captures/chicken-quesadilla.json';
import chickenShawarma from './captures/chicken-shawarma.json';
import chickenStirFry from './captures/chicken-stir-fry.json';
import chickenTeriyaki from './captures/chicken-teriyaki.json';
import chickenTikkaMasala from './captures/chicken-tikka-masala.json';
import chickenWings from './captures/chicken-wings.json';
import chiliConCarne from './captures/chili-con-carne.json';
import clubSandwich from './captures/club-sandwich.json';
import cobbSalad from './captures/cobb-salad.json';
import eggsBenedict from './captures/eggs-benedict.json';
import falafelWrap from './captures/falafel-wrap.json';
import fishAndChips from './captures/fish-and-chips.json';
import frenchToast from './captures/french-toast.json';
import friedChicken from './captures/fried-chicken.json';
import friedChickenSandwich from './captures/fried-chicken-sandwich.json';
import fullEnglishBreakfast from './captures/full-english-breakfast.json';
import greekSalad from './captures/greek-salad.json';
import greekYogurtParfait from './captures/greek-yogurt-parfait.json';
import gyro from './captures/gyro.json';
import hotDog from './captures/hot-dog.json';
import lasagna from './captures/lasagna.json';
import macAndCheese from './captures/mac-and-cheese.json';
import margheritaPizza from './captures/margherita-pizza.json';
import nachos from './captures/nachos.json';
import oatmeal from './captures/oatmeal.json';
import orangeChicken from './captures/orange-chicken.json';
import padThai from './captures/pad-thai.json';
import pancakes from './captures/pancakes.json';
import pepperoniPizza from './captures/pepperoni-pizza.json';
import pho from './captures/pho.json';
import pokeBowl from './captures/poke-bowl.json';
import ramen from './captures/ramen.json';
import spaghettiBolognese from './captures/spaghetti-bolognese.json';
import spaghettiCarbonara from './captures/spaghetti-carbonara.json';
import sushiRolls from './captures/sushi-rolls.json';
import thaiGreenCurry from './captures/thai-green-curry.json';
import type { FoodSlug } from './slugs';
import type { FoodPageCapture } from './types';

export const CAPTURES: Record<FoodSlug, FoodPageCapture> = {
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
};
