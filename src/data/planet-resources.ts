// Static planet resource data for Warframe
// Source: Warframe Wiki — these are resources that drop from enemies/containers on each planet.
// Dark sector nodes have +20-25% resource drop rate bonus (varies by node).

export interface DarkSectorNode {
  name: string;
  planet: string;
  missionType: string;
  resourceBonus: number; // percentage, e.g. 20 = +20%
  creditBonus: number;   // percentage
}

export interface PlanetData {
  resources: string[];
  darkSectors: DarkSectorNode[];
  levelRange: string;
  faction: string;
}

// Which resources drop on which planet (from enemies and containers)
export const PLANET_RESOURCES: Record<string, PlanetData> = {
  Earth: {
    resources: ["Ferrite", "Polymer Bundle", "Detonite Ampule", "Neurodes", "Rubedo"],
    darkSectors: [
      { name: "Coba", planet: "Earth", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Tikal", planet: "Earth", missionType: "Excavation", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "1-6",
    faction: "Grineer",
  },
  Venus: {
    resources: ["Alloy Plate", "Polymer Bundle", "Circuits", "Fieldron Sample"],
    darkSectors: [
      { name: "Romula", planet: "Venus", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Malva", planet: "Venus", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "3-18",
    faction: "Corpus",
  },
  Mercury: {
    resources: ["Ferrite", "Polymer Bundle", "Detonite Ampule", "Morphics"],
    darkSectors: [],
    levelRange: "6-14",
    faction: "Grineer",
  },
  Mars: {
    resources: ["Ferrite", "Salvage", "Detonite Ampule", "Morphics", "Gallium"],
    darkSectors: [
      { name: "Kadesh", planet: "Mars", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Wahiba", planet: "Mars", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "6-14",
    faction: "Grineer",
  },
  Phobos: {
    resources: ["Alloy Plate", "Rubedo", "Morphics", "Plastids"],
    darkSectors: [
      { name: "Memphis", planet: "Phobos", missionType: "Defection", resourceBonus: 20, creditBonus: 20 },
      { name: "Zeugma", planet: "Phobos", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "10-20",
    faction: "Corpus",
  },
  Ceres: {
    resources: ["Alloy Plate", "Circuits", "Detonite Ampule", "Orokin Cells"],
    darkSectors: [
      { name: "Seimeni", planet: "Ceres", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Gabii", planet: "Ceres", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "12-22",
    faction: "Grineer",
  },
  Jupiter: {
    resources: ["Alloy Plate", "Salvage", "Fieldron Sample", "Neural Sensors", "Hexenon"],
    darkSectors: [
      { name: "Sinai", planet: "Jupiter", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Cameria", planet: "Jupiter", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "15-25",
    faction: "Corpus",
  },
  Europa: {
    resources: ["Ferrite", "Rubedo", "Fieldron Sample", "Morphics"],
    darkSectors: [
      { name: "Larzac", planet: "Europa", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Cholistan", planet: "Europa", missionType: "Excavation", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "18-28",
    faction: "Corpus",
  },
  Saturn: {
    resources: ["Nano Spores", "Plastids", "Orokin Cells"],
    darkSectors: [
      { name: "Caracol", planet: "Saturn", missionType: "Defection", resourceBonus: 20, creditBonus: 20 },
      { name: "Piscinas", planet: "Saturn", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "20-30",
    faction: "Grineer",
  },
  Uranus: {
    resources: ["Ferrite", "Polymer Bundle", "Detonite Ampule", "Plastids", "Gallium", "Tellurium"],
    darkSectors: [
      { name: "Ur", planet: "Uranus", missionType: "Disruption", resourceBonus: 20, creditBonus: 20 },
      { name: "Assur", planet: "Uranus", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "24-34",
    faction: "Grineer",
  },
  Neptune: {
    resources: ["Nano Spores", "Ferrite", "Fieldron Sample", "Control Module"],
    darkSectors: [
      { name: "Yursa", planet: "Neptune", missionType: "Defection", resourceBonus: 20, creditBonus: 20 },
      { name: "Kelashin", planet: "Neptune", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "27-37",
    faction: "Corpus",
  },
  Pluto: {
    resources: ["Alloy Plate", "Rubedo", "Fieldron Sample", "Morphics", "Plastids"],
    darkSectors: [
      { name: "Sechura", planet: "Pluto", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Hieracon", planet: "Pluto", missionType: "Excavation", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "30-40",
    faction: "Corpus",
  },
  Sedna: {
    resources: ["Alloy Plate", "Salvage", "Circuits", "Detonite Ampule"],
    darkSectors: [
      { name: "Sangeru", planet: "Sedna", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Amarna", planet: "Sedna", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "30-44",
    faction: "Grineer",
  },
  Eris: {
    resources: ["Nano Spores", "Plastids", "Neurodes", "Mutagen Sample"],
    darkSectors: [
      { name: "Akkad", planet: "Eris", missionType: "Defense", resourceBonus: 20, creditBonus: 20 },
      { name: "Zabala", planet: "Eris", missionType: "Survival", resourceBonus: 25, creditBonus: 25 },
    ],
    levelRange: "30-44",
    faction: "Infested",
  },
  Void: {
    resources: ["Ferrite", "Rubedo", "Argon Crystal", "Control Module"],
    darkSectors: [],
    levelRange: "10-45",
    faction: "Corrupted",
  },
  "Kuva Fortress": {
    resources: ["Salvage", "Circuits", "Detonite Ampule"],
    darkSectors: [],
    levelRange: "30-45",
    faction: "Grineer",
  },
  Lua: {
    resources: ["Ferrite", "Salvage", "Circuits", "Neurodes"],
    darkSectors: [],
    levelRange: "25-35",
    faction: "Mixed",
  },
  Deimos: {
    resources: ["Nano Spores", "Mutagen Sample", "Orokin Cells"],
    darkSectors: [],
    levelRange: "8-45",
    faction: "Infested",
  },
};

// Common resource aliases / alternate names
export const RESOURCE_ALIASES: Record<string, string> = {
  "nano spore": "Nano Spores",
  "nanospores": "Nano Spores",
  "neural sensor": "Neural Sensors",
  "neurals": "Neural Sensors",
  "neurode": "Neurodes",
  "orokin cell": "Orokin Cells",
  "cells": "Orokin Cells",
  "o cells": "Orokin Cells",
  "ocells": "Orokin Cells",
  "polymer": "Polymer Bundle",
  "polymers": "Polymer Bundle",
  "poly": "Polymer Bundle",
  "alloy": "Alloy Plate",
  "alloys": "Alloy Plate",
  "argon": "Argon Crystal",
  "argons": "Argon Crystal",
  "control module": "Control Module",
  "control modules": "Control Module",
  "plastid": "Plastids",
  "morphic": "Morphics",
  "rubedos": "Rubedo",
  "galliums": "Gallium",
  "tellurium": "Tellurium",
  "hexenons": "Hexenon",
  "circuit": "Circuits",
  "fieldron samples": "Fieldron Sample",
  "detonite ampules": "Detonite Ampule",
  "mutagen samples": "Mutagen Sample",
  "ferrites": "Ferrite",
};

// Recommended farming mission types (ordered by efficiency)
export const PREFERRED_MISSION_TYPES = [
  "Survival",      // Best for AFK-style resource farming
  "Defense",       // Consistent waves, good for resources
  "Excavation",    // High resource yield + endo/relics
  "Disruption",    // Fast rotations
  "Exterminate",   // Quick runs
  "Capture",       // Fastest clear time
] as const;
