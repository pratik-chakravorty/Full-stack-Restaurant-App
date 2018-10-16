import axios from "axios";
import { $ } from "./bling";

//drawing the map on the page
const mapOptions = {
  center: { lat: 43.2, lng: -79.8 },
  zoom: 10
};
function loadPlaces(map, lat = 43.2, lng = -79.8) {
  axios.get(`/api/stores/near?lat=${lat}&lng=${lng}`).then(res => {
    const places = res.data;
    if (!places.length) {
      alert("no places found");
      return;
    }

    //bounds
    const bounds = new google.maps.LatLngBounds();
    //creating the info window
    const infoWindow = new google.maps.InfoWindow();

    //making the markers from each of the place returned
    const markers = places.map(place => {
      //extract the lat and lng from each of the places
      const [placeLng, placeLat] = place.location.coordinates;
      //put them in an object
      const position = { lat: placeLat, lng: placeLng };
      bounds.extend(position); //we get the correct zoom level
      //create the marker based on the position obj
      const marker = new google.maps.Marker({ map, position });
      //put the additional info like images name address in the marker.
      marker.place = place;
      return marker;
    });

    //when the someone clicks on a marker show the detail of that place
    markers.forEach(marker =>
      marker.addListener("click", function() {
        const html = `
            <div class="popup">
                <a href="/store/${this.place.slug}">
                    <img src="/uploads/${this.place.photo ||
                      "store.png"}" alt="${this.place.name}"/>
                    <p>${this.place.name} - ${this.place.location.address}</p>
                    </a>
            </div>
        `;
        infoWindow.setContent(html);
        infoWindow.open(map, this);
      })
    );
    //then the zoom the fit all the markers perfectly
    map.setCenter(bounds.getCenter());
    map.fitBounds(bounds);
  });
}

function makeMap(mapDiv) {
  if (!mapDiv) return;
  //make the map
  const map = new google.maps.Map(mapDiv, mapOptions);
  loadPlaces(map);
  const input = $('[name="geolocate"]');
  const autocomplete = new google.maps.places.Autocomplete(input);
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    loadPlaces(
      map,
      place.geometry.location.lat(),
      place.geometry.location.lng()
    );
  });
}

export default makeMap;
