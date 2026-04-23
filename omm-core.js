class OmmModel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.shadowRoot.appendChild(this.canvas);
        
        this.camera = { z: 600, rx: 0.4, ry: 0.4 };
        this.objects = [];
        this.textures = {};
        this.focal = 600;
        this.isAnimating = false;
    }

    connectedCallback() {
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        
        setTimeout(() => {
            this.resize();
            this.loadContent();
        }, 50);
    }

    async loadContent() {
        // Проверяем атрибут src или текст внутри тега
        let content = this.getAttribute('src') || this.textContent.trim();
        
        // Если это путь к файлу (заканчивается на .omm)
        if (content.endsWith('.omm')) {
            try {
                const response = await fetch(content);
                if (response.ok) {
                    const text = await response.text();
                    this.parse(text);
                } else {
                    console.error(`OMM Error: Не удалось загрузить файл ${content}`);
                }
            } catch (e) {
                console.error("OMM Error: Ошибка сети", e);
            }
        } else {
            // Если внутри просто текст модели
            this.parse(content);
        }

        if (this.hasAttribute('autorate')) {
            this.isAnimating = true;
            this.animate();
        } else {
            this.render();
        }
    }

    resize() {
        this.canvas.width = this.offsetWidth || 300;
        this.canvas.height = this.offsetHeight || 300;
    }

    parse(txt) {
        this.objects = [];
        let current = null;
        txt.split('\n').forEach(l => {
            l = l.trim();
            if (!l || l.startsWith('//')) return;
            
            if (l.startsWith('image3') || l.startsWith('cube3')) {
                let sy = 1;
                if (l.includes(':')) sy = 1/parseFloat(l.split(':')[1]);
                current = { 
                    type: l.startsWith('image3') ? 'image' : 'cube',
                    x:0, y:0, z:0, s:50, sy, rx:0, ry:0, col:'200,200,200', tex:null 
                };
                this.objects.push(current);
            }

            if (current) {
                const val = (k) => { const m = l.match(new RegExp(k + '\\((.*?)\\)')); return m ? m[1] : null; };
                const x = val('x'), y = val('y'), z = val('z'), s = val('scale'), rr = val('rr'), ru = val('ru'), c = val('color'), t = val('texture');
                if (x) current.x = parseFloat(x);
                if (y) current.y = parseFloat(y);
                if (z) current.z = parseFloat(z);
                if (s) current.s *= parseFloat(s);
                if (rr) current.ry = parseFloat(rr) * Math.PI/180;
                if (ru) current.rx = parseFloat(ru) * Math.PI/180;
                if (c) current.col = c;
                if (t) current.tex = this.getImg(t);
            }
        });
        this.render();
    }

    getImg(s) {
        if (this.textures[s]) return this.textures[s];
        const i = new Image(); i.src = s;
        i.onload = () => this.render();
        return this.textures[s] = i;
    }

    project(p, obj) {
        let x = p.x, y = p.y, z = p.z;
        let ty = y * Math.cos(obj.rx) - z * Math.sin(obj.rx);
        let tz = y * Math.sin(obj.rx) + z * Math.cos(obj.rx);
        let tx = x * Math.cos(obj.ry) + tz * Math.sin(obj.ry);
        tz = -x * Math.sin(obj.ry) + tz * Math.cos(obj.ry);
        tx += obj.x; ty += obj.y; tz += obj.z;
        let ry = ty * Math.cos(this.camera.rx) - tz * Math.sin(this.camera.rx);
        let rz = ty * Math.sin(this.camera.rx) + tz * Math.cos(this.camera.rx);
        let rx = tx * Math.cos(this.camera.ry) + rz * Math.sin(this.camera.ry);
        rz = -tx * Math.sin(this.camera.ry) + rz * Math.cos(this.camera.ry);
        const sc = this.focal / (this.focal + rz + this.camera.z);
        return { x: rx * sc + this.canvas.width/2, y: ry * sc + this.canvas.height/2, z: rz, sc };
    }

    drawTexturedTriangle(p1, p2, p3, u1, v1, u2, v2, u3, v3, img) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.lineTo(p3.x, p3.y);
        this.ctx.closePath();
        this.ctx.clip();
        const det = (u2 - u1) * (v3 - v1) - (u3 - u1) * (v2 - v1);
        const idet = 1 / det;
        const m11 = ((p2.x - p1.x) * (v3 - v1) - (p3.x - p1.x) * (v2 - v1)) * idet;
        const m12 = ((p2.y - p1.y) * (v3 - v1) - (p3.y - p1.y) * (v2 - v1)) * idet;
        const m21 = ((p3.x - p1.x) * (u2 - u1) - (p2.x - p1.x) * (u3 - u1)) * idet;
        const m22 = ((p3.y - p1.y) * (u2 - u1) - (p2.y - p1.y) * (u3 - u1)) * idet;
        const dx = p1.x - m11 * u1 - m21 * v1;
        const dy = p1.y - m12 * u1 - m22 * v1;
        this.ctx.setTransform(m11, m12, m21, m22, dx, dy);
        this.ctx.drawImage(img, 0, 0);
        this.ctx.restore();
    }

    animate() {
        if (!this.isAnimating) return;
        this.camera.ry += 0.01;
        this.render();
        requestAnimationFrame(() => this.animate());
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.objects.sort((a,b) => b.z - a.z);
        this.objects.forEach(obj => {
            const s = obj.s, sy = s * obj.sy;
            if (obj.type === 'cube') {
                const v = [{x:-s,y:-sy,z:-s},{x:s,y:-sy,z:-s},{x:s,y:sy,z:-s},{x:-s,y:sy,z:-s},
                           {x:-s,y:-sy,z:s},{x:s,y:-sy,z:s},{x:s,y:sy,z:s},{x:-s,y:sy,z:s}];
                const faces = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[0,3,7,4],[1,2,6,5]];
                const pts = v.map(p => this.project(p, obj));
                faces.forEach((f, i) => {
                    const p1 = pts[f[0]], p2 = pts[f[1]], p3 = pts[f[2]], p4 = pts[f[3]];
                    if ((p2.x-p1.x)*(p3.y-p1.y) - (p2.y-p1.y)*(p3.x-p1.x) < 0) {
                        if (obj.tex && obj.tex.complete) {
                            this.drawTexturedTriangle(p1, p2, p3, 0, 0, obj.tex.width, 0, obj.tex.width, obj.tex.height, obj.tex);
                            this.drawTexturedTriangle(p1, p3, p4, 0, 0, obj.tex.width, obj.tex.height, 0, obj.tex.height, obj.tex);
                        } else {
                            this.ctx.beginPath();
                            f.forEach((idx, j) => j==0 ? this.ctx.moveTo(pts[idx].x, pts[idx].y) : this.ctx.lineTo(pts[idx].x, pts[idx].y));
                            this.ctx.closePath();
                            const rgb = obj.col.split(',');
                            const sh = 0.6 + (i * 0.1);
                            this.ctx.fillStyle = `rgb(${rgb[0]*sh},${rgb[1]*sh},${rgb[2]*sh})`;
                            this.ctx.fill();
                        }
                    }
                });
            } else if (obj.type === 'image') {
                const v = [{x:-s,y:-sy,z:0},{x:s,y:-sy,z:0},{x:s,y:sy,z:0},{x:-s,y:sy,z:0}];
                const pts = v.map(p => this.project(p, obj));
                if (obj.tex && obj.tex.complete) {
                    this.drawTexturedTriangle(pts[0], pts[1], pts[2], 0, 0, obj.tex.width, 0, obj.tex.width, obj.tex.height, obj.tex);
                    this.drawTexturedTriangle(pts[0], pts[2], pts[3], 0, 0, obj.tex.width, obj.tex.height, 0, obj.tex.height, obj.tex);
                }
            }
        });
    }
}
customElements.define('omm-model', OmmModel);