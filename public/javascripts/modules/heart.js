import axios from "axios";
import { $ } from "./bling";
function ajaxHeart(e) {
  e.preventDefault(); //prevent page refresh
  axios //get the data
    .post(this.action) //this => will be the form tag
    .then(res => {
      const isHearted = this.heart.classList.toggle("heart__button--hearted"); //this.heart will give the button
      $(".heart-count").textContent = res.data.hearts.length;
      if (isHearted) {
        this.heart.classList.add("heart__button--float");
        setTimeout(() => {
          this.heart.classList.remove("heart__button--float");
        }, 2500);
      }
    })
    .catch(err => console.error(err));
}

export default ajaxHeart;
