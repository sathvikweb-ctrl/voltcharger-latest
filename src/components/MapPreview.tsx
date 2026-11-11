"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { googleMapsDirectionsUrl } from "@/lib/googleMaps";

const pinIcon = L.divIcon({
  className: "volt-map-pin",
  html: '<div class="volt-pin"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export type MapCharger = {
  id: string;
  city: string;
  price: number;
  type: string;
  capacity: number;
  lat: number;
  lng: number;
  label: string;
};

type MapPreviewProps = {
  chargers: MapCharger[];
  center?: [number, number];
  selectedLocation?: { lat: number; lng: number };
  onLocationSelect?: (location: { lat: number; lng: number }) => void;
};

function MapClickHandler({ onLocationSelect }: { onLocationSelect: (location: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(event) {
      onLocationSelect({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export function MapPreview({ chargers, center: requestedCenter, selectedLocation, onLocationSelect }: MapPreviewProps) {
  const center = requestedCenter ?? (chargers[0] ? [chargers[0].lat, chargers[0].lng] as [number, number] : [17.4401, 78.3489] as [number, number]);

  return (
    <MapContainer center={center} zoom={11} scrollWheelZoom className="leaflet-map">
      {requestedCenter ? <MapRecenter center={requestedCenter} /> : null}
      {onLocationSelect ? <MapClickHandler onLocationSelect={onLocationSelect} /> : null}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {chargers.map((charger) => (
        <Marker key={charger.id} position={[charger.lat, charger.lng]} icon={pinIcon}>
          <Popup>
            <strong>{charger.label}</strong><br />
            {charger.type} • {charger.capacity} kW<br />
            ₹{charger.price}/kWh<br />
            <a href={googleMapsDirectionsUrl(`${charger.lat},${charger.lng}`)} target="_blank" rel="noreferrer">Get directions</a>
          </Popup>
        </Marker>
      ))}
      {selectedLocation ? <Marker position={[selectedLocation.lat, selectedLocation.lng]} icon={pinIcon} /> : null}
    </MapContainer>
  );
}
