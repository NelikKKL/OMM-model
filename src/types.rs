// ── Geometry ──────────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Default)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

pub type Face = Vec<usize>;

pub struct Geometry {
    pub v:     Vec<Vec3>,
    pub faces: Vec<Face>,
}

// ── Object model ──────────────────────────────────────────────────────────────

#[derive(Clone, Debug, PartialEq)]
pub enum ShapeType {
    Cube,
    Pyramid,
    Triangle,
    Sphere,
    Cylinder,
    Image,
}

impl ShapeType {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "cube3"     => Some(Self::Cube),
            "pyramid3"  => Some(Self::Pyramid),
            "triangle3" => Some(Self::Triangle),
            "sphere3"   => Some(Self::Sphere),
            "cylinder3" => Some(Self::Cylinder),
            "image3"    => Some(Self::Image),
            _           => None,
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct AnimationKeyframe {
    pub x:  Option<f64>,
    pub y:  Option<f64>,
    pub z:  Option<f64>,
    pub rr: Option<f64>, // degrees
    pub ru: Option<f64>, // degrees
}

#[derive(Clone, Debug)]
pub struct OmmObject {
    pub shape: ShapeType,
    // Position
    pub x: f64, pub y: f64, pub z: f64,
    // Scale
    pub s: f64, pub sy: f64,
    // Rotation (radians)
    pub rx: f64, pub ry: f64,
    // Color
    pub rgb: [u8; 3],
    // Texture URL/data-URI
    pub tex_src: Option<String>,
    // Asymmetric deform
    pub ur: f64, pub ul: f64,
    pub ug: f64, pub um: f64,
    pub ud: f64, pub uu: f64,
    // Animation
    pub anim:       Option<Vec<AnimationKeyframe>>,
    pub anim_index: usize,
    pub anim_speed: f64,
}

impl Default for OmmObject {
    fn default() -> Self {
        Self {
            shape: ShapeType::Cube,
            x: 0.0, y: 0.0, z: 0.0,
            s: 50.0, sy: 1.0,
            rx: 0.0, ry: 0.0,
            rgb: [200, 200, 200],
            tex_src: None,
            ur: 0.0, ul: 0.0, ug: 0.0, um: 0.0, ud: 0.0, uu: 0.0,
            anim: None,
            anim_index: 0,
            anim_speed: 2.0,
        }
    }
}

// ── Mono group ────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct MonoGroupTransform {
    pub x: f64, pub y: f64, pub z: f64,
    pub rx: f64, pub ry: f64,
    pub scale: f64,
}

impl MonoGroupTransform {
    pub fn new() -> Self {
        Self { scale: 1.0, ..Default::default() }
    }
}

pub struct MonoGroup {
    pub members: Vec<usize>, // indices into objects Vec
}

// ── Camera ────────────────────────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct Camera {
    pub z:  f64,
    pub rx: f64,
    pub ry: f64,
    pub cx: f64,
    pub cy: f64,
}

impl Default for Camera {
    fn default() -> Self {
        Self { z: 600.0, rx: 0.4, ry: 0.4, cx: 0.0, cy: 0.0 }
    }
}

pub struct CameraTrig {
    pub srx: f64, pub crx: f64,
    pub sry: f64, pub cry: f64,
}
