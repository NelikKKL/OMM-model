/*
library
canvas 3D Models 
License MIT 
Author NelikKKL
good using :3 !!!!!
 */
 /*
Библиотека
canvas 3D модели
Лицензия MIT 
Автор NelikKKL
Хорошего использования  Няя :3 !!!!!
 */
/*
⣇⣿⠘⣿⣿⣿⡿⡿⣟⣟⢟⢟⢝⠵⡝⣿⡿⢂⣼⣿⣷⣌⠩⡫⡻⣝⠹⢿⣿⣷
⡆⣿⣆⠱⣝⡵⣝⢅⠙⣿⢕⢕⢕⢕⢝⣥⢒⠅⣿⣿⣿⡿⣳⣌⠪⡪⣡⢑⢝⣇
⡆⣿⣿⣦⠹⣳⣳⣕⢅⠈⢗⢕⢕⢕⢕⢕⢈⢆⠟⠋⠉⠁⠉⠉⠁⠈⠼⢐⢕⢽
⡗⢰⣶⣶⣦⣝⢝⢕⢕⠅⡆⢕⢕⢕⢕⢕⣴⠏⣠⡶⠛⡉⡉⡛⢶⣦⡀⠐⣕⢕
⡝⡄⢻⢟⣿⣿⣷⣕⣕⣅⣿⣔⣕⣵⣵⣿⣿⢠⣿⢠⣮⡈⣌⠨⠅⠹⣷⡀⢱⢕
⡝⡵⠟⠈⢀⣀⣀⡀⠉⢿⣿⣿⣿⣿⣿⣿⣿⣼⣿⢈⡋⠴⢿⡟⣡⡇⣿⡇⡀⢕
⡝⠁⣠⣾⠟⡉⡉⡉⠻⣦⣻⣿⣿⣿⣿⣿⣿⣿⣿⣧⠸⣿⣦⣥⣿⡇⡿⣰⢗⢄
⠁⢰⣿⡏⣴⣌⠈⣌⠡⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣬⣉⣉⣁⣄⢖⢕⢕⢕
⡀⢻⣿⡇⢙⠁⠴⢿⡟⣡⡆⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣵⣵⣿
⡻⣄⣻⣿⣌⠘⢿⣷⣥⣿⠇⣿⣿⣿⣿⣿⣿⠛⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
⣷⢄⠻⣿⣟⠿⠦⠍⠉⣡⣾⣿⣿⣿⣿⣿⣿⢸⣿⣦⠙⣿⣿⣿⣿⣿⣿⣿⣿⠟
⡕⡑⣑⣈⣻⢗⢟⢞⢝⣻⣿⣿⣿⣿⣿⣿⣿⠸⣿⠿⠃⣿⣿⣿⣿⣿⣿⡿⠁⣠
⡝⡵⡈⢟⢕⢕⢕⢕⣵⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣿⣿⣿⣿⣿⠿⠋⣀⣈⠙
⡝⡵⡕⡀⠑⠳⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠛⢉⡠⡲⡫⡪⡪⡣ 
*/

class OmmModel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.shadowRoot.appendChild(this.canvas);
        
        // Добавили cx и cy для перемещения камеры (pan)
        this.camera = { z: 600, rx: 0.4, ry: 0.4, cx: 0, cy: 0 };
        this.objects = [];
        this.textures = {};
        this.focal = 600;
        this.isAnimating = false;
        this.animationRequested = false;
    }

    connectedCallback() {
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        
        // Инициализация свободного управления, если есть атрибут freer
        if (this.hasAttribute('freer')) {
            this.initControls();
        }

        setTimeout(() => {
            this.resize();
            this.loadContent();
        }, 50);
    }

    initControls() {
        let isDragging = false;
        let dragMode = 0; // 0 = Вращение, 1 = Перемещение (Pan)
        let lastX = 0, lastY = 0;
        let initialPinchDist = null;
        let initialZ = null;

        this.canvas.style.cursor = 'grab';

        const startDrag = (x, y, btn) => {
            isDragging = true;
            lastX = x;
            lastY = y;
            // Правая кнопка мыши (2) или колесико (1) активируют режим перемещения
            dragMode = (btn === 2 || btn === 1) ? 1 : 0;
            this.canvas.style.cursor = dragMode === 0 ? 'grabbing' : 'move';
        };

        const doDrag = (x, y) => {
            if (!isDragging) return;
            const dx = x - lastX;
            const dy = y - lastY;
            lastX = x;
            lastY = y;

            if (dragMode === 0) {
                // Вращение (Rotation)
                this.camera.ry -= dx * 0.01;
                this.camera.rx += dy * 0.01;
            } else {
                // Перемещение (Panning)
                this.camera.cx += dx;
                this.camera.cy += dy;
            }
            
            if (!this.isAnimating) this.render();
        };

        const endDrag = () => { 
            isDragging = false; 
            this.canvas.style.cursor = 'grab';
        };

        // --- Управление мышью ---
        this.canvas.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY, e.button));
        // Вешаем слушатели на window, чтобы мышь не "отлипала", если уходит за пределы канваса
        window.addEventListener('mousemove', (e) => { if (isDragging) doDrag(e.clientX, e.clientY); });
        window.addEventListener('mouseup', endDrag);
        
        // Блокируем контекстное меню браузера при нажатии ПКМ
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        // Зумирование колесиком мыши
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.z += e.deltaY * 0.5;
            // Ограничиваем приближение, чтобы не "провалиться" сквозь объекты
            if (this.camera.z < -this.focal + 10) this.camera.z = -this.focal + 10;
            if (!this.isAnimating) this.render();
        }, { passive: false });

        // --- Управление на смартфонах (Тач-события) ---
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                // Один палец - вращение
                startDrag(e.touches[0].clientX, e.touches[0].clientY, 0);
            } else if (e.touches.length === 2) {
                // Два пальца - зумирование (щипок)
                isDragging = false;
                initialPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX, 
                    e.touches[0].clientY - e.touches[1].clientY
                );
                initialZ = this.camera.z;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1 && isDragging) {
                doDrag(e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2 && initialPinchDist) {
                const currentPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX, 
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const scale = initialPinchDist / currentPinchDist;
                this.camera.z = initialZ * scale;
                // Ограничитель для тача
                if (this.camera.z < -this.focal + 10) this.camera.z = -this.focal + 10;
                if (!this.isAnimating) this.render();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => { 
            endDrag(); 
            initialPinchDist = null;
        });
    }

    async loadContent() {
        let content = this.getAttribute('src') || this.textContent.trim();
        
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
            this.parse(content);
        }

        // Запускаем анимацию, если есть атрибуты
        if (this.hasAttribute('autorate') || this.isAnimating) {
            this.isAnimating = true;
            if (!this.animationRequested) {
                this.animationRequested = true;
                this.animate();
            }
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
            
            const match = l.match(/^(image3|cube3|pyramid3|triangle3|sphere3|cylinder3)/);
            if (match) {
                let typeStr = match[1];
                let sy = 1;
                if (l.includes(':')) sy = 1/parseFloat(l.split(':')[1]);
                
                current = { 
                    type: typeStr.replace('3', ''), 
                    x:0, y:0, z:0, s:50, sy, rx:0, ry:0, col:'200,200,200', tex:null,
                    ur:0, ul:0, ug:0, um:0, ud:0, uu:0 
                };
                this.objects.push(current);
            }

            if (current) {
                const val = (k) => { const m = l.match(new RegExp(k + '\\((.*?)\\)')); return m ? m[1] : null; };
                
                const x = val('x'), y = val('y'), z = val('z'), s = val('scale'), rr = val('rr'), ru = val('ru'), c = val('color'), t = val('texture');
                const ur = val('ur'), ul = val('ul'), ug = val('ug'), um = val('um'), ud = val('ud'), uu = val('uu');

                if (x) current.x = parseFloat(x);
                if (y) current.y = parseFloat(y);
                if (z) current.z = parseFloat(z);
                if (s) current.s *= parseFloat(s);
                if (rr) current.ry = parseFloat(rr) * Math.PI/180;
                if (ru) current.rx = parseFloat(ru) * Math.PI/180;
                if (c) current.col = c.replace(/\s/g, ''); 
                if (t) current.tex = this.getImg(t);
                
                if (ur) current.ur = parseFloat(ur);
                if (ul) current.ul = parseFloat(ul);
                if (ug) current.ug = parseFloat(ug);
                if (um) current.um = parseFloat(um);
                if (ud) current.ud = parseFloat(ud);
                if (uu) current.uu = parseFloat(uu);

                const animMatch = l.match(/animation\((.+?)\)/);
                if (animMatch) {
                    current.anim = [];
                    current.animIndex = 0;
                    current.animSpeed = 2.0; 
                    
                    const frames = animMatch[1].split(',');
                    frames.forEach(frame => {
                        const kf = {};
                        const props = frame.match(/([a-z]+)(-?[\d.]+)/g);
                        if (props) {
                            props.forEach(p => {
                                const m = p.match(/([a-z]+)(-?[\d.]+)/);
                                if (m) kf[m[1]] = parseFloat(m[2]);
                            });
                            current.anim.push(kf);
                        }
                    });
                    this.isAnimating = true; 
                }
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
        
        // Добавили смещение cx и cy из объекта camera
        return { 
            x: rx * sc + this.canvas.width/2 + this.camera.cx, 
            y: ry * sc + this.canvas.height/2 + this.camera.cy, 
            z: rz, 
            sc 
        };
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
        
        if (this.hasAttribute('autorate')) {
            this.camera.ry += 0.01;
        }

        this.objects.forEach(obj => {
            if (obj.anim && obj.anim.length > 0) {
                const target = obj.anim[obj.animIndex];
                const speed = obj.animSpeed;
                const rotSpeed = 0.05; 

                const tx = target.x !== undefined ? target.x : obj.x;
                const ty = target.y !== undefined ? target.y : obj.y;
                const tz = target.z !== undefined ? target.z : obj.z;
                
                const trx = target.ru !== undefined ? target.ru * Math.PI/180 : obj.rx;
                const try_ = target.rr !== undefined ? target.rr * Math.PI/180 : obj.ry;

                const dx = tx - obj.x;
                const dy = ty - obj.y;
                const dz = tz - obj.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

                if (dist > speed) {
                    obj.x += (dx / dist) * speed;
                    obj.y += (dy / dist) * speed;
                    obj.z += (dz / dist) * speed;
                } else {
                    obj.x = tx; obj.y = ty; obj.z = tz;
                }

                if (Math.abs(trx - obj.rx) > rotSpeed) obj.rx += Math.sign(trx - obj.rx) * rotSpeed;
                else obj.rx = trx;

                if (Math.abs(try_ - obj.ry) > rotSpeed) obj.ry += Math.sign(try_ - obj.ry) * rotSpeed;
                else obj.ry = try_;

                if (dist <= speed && Math.abs(trx - obj.rx) <= rotSpeed && Math.abs(try_ - obj.ry) <= rotSpeed) {
                    obj.animIndex++; 
                    if (obj.animIndex >= obj.anim.length) {
                        obj.animIndex = 0; 
                    }
                }
            }
        });

        this.render();
        requestAnimationFrame(() => this.animate());
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.objects.sort((a,b) => b.z - a.z);
        
        this.objects.forEach(obj => {
            const s = obj.s, sy = s * obj.sy;
            let v = [], faces = [];

            if (obj.type === 'cube') {
                v = [{x:-s,y:-sy,z:-s},{x:s,y:-sy,z:-s},{x:s,y:sy,z:-s},{x:-s,y:sy,z:-s},
                     {x:-s,y:-sy,z:s},{x:s,y:-sy,z:s},{x:s,y:sy,z:s},{x:-s,y:sy,z:s}];
                faces = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[0,3,7,4],[1,2,6,5]];
            } 
            else if (obj.type === 'pyramid') {
                v = [{x:0,y:-sy,z:0}, {x:-s,y:sy,z:-s}, {x:s,y:sy,z:-s}, {x:s,y:sy,z:s}, {x:-s,y:sy,z:s}];
                faces = [[0,2,1], [0,3,2], [0,4,3], [0,1,4], [4,3,2,1]];
            }
            else if (obj.type === 'triangle') {
                v = [{x:0,y:-sy,z:0}, {x:s,y:sy,z:0}, {x:-s,y:sy,z:0}];
                faces = [[0,1,2]];
            }
            else if (obj.type === 'sphere') {
                const latBands = 8, longBands = 8;
                for (let lat=0; lat<=latBands; lat++) {
                    let theta = lat*Math.PI/latBands, sinTheta=Math.sin(theta), cosTheta=Math.cos(theta);
                    for (let lon=0; lon<=longBands; lon++) {
                        let phi = lon*2*Math.PI/longBands, sinPhi=Math.sin(phi), cosPhi=Math.cos(phi);
                        v.push({x: s*cosPhi*sinTheta, y: sy*cosTheta, z: s*sinPhi*sinTheta});
                    }
                }
                for (let lat=0; lat<latBands; lat++) {
                    for (let lon=0; lon<longBands; lon++) {
                        let first = (lat*(longBands+1))+lon, second = first+longBands+1;
                        faces.push([first, second, first+1]);
                        faces.push([second, second+1, first+1]);
                    }
                }
            }
            else if (obj.type === 'cylinder') {
                const seg = 10;
                for (let i=0; i<seg; i++) {
                    let theta = (i/seg)*Math.PI*2;
                    v.push({x: s*Math.cos(theta), y: -sy, z: s*Math.sin(theta)});
                    v.push({x: s*Math.cos(theta), y: sy, z: s*Math.sin(theta)});
                }
                v.push({x:0, y:-sy, z:0});
                v.push({x:0, y:sy, z:0});
                const tc = v.length-2, bc = v.length-1;
                for (let i=0; i<seg; i++) {
                    let currTop = i*2, currBot = i*2+1;
                    let nextTop = ((i+1)%seg)*2, nextBot = ((i+1)%seg)*2+1;
                    faces.push([currTop, nextTop, nextBot, currBot]);
                    faces.push([tc, currTop, nextTop]);
                    faces.push([bc, nextBot, currBot]);
                }
            }
            else if (obj.type === 'image') {
                v = [{x:-s,y:-sy,z:0},{x:s,y:-sy,z:0},{x:s,y:sy,z:0},{x:-s,y:sy,z:0}];
            }

            const ur = obj.ur || 0, ul = obj.ul || 0;
            const ug = obj.ug || 0, um = obj.um || 0;
            const ud = obj.ud || 0, uu = obj.uu || 0;

            if (ur || ul || ug || um || ud || uu) {
                v.forEach(p => {
                    if (p.x > 0 && s) p.x = (p.x / s) * (s + ur);
                    else if (p.x < 0 && s) p.x = (p.x / s) * (s + ul);
                    
                    if (p.y > 0 && sy) p.y = (p.y / sy) * (sy + ud);
                    else if (p.y < 0 && sy) p.y = (p.y / sy) * (sy + uu);
                    
                    if (p.z > 0 && s) p.z = (p.z / s) * (s + ug);
                    else if (p.z < 0 && s) p.z = (p.z / s) * (s + um);
                });
            }

            if (obj.type === 'image') {
                const pts = v.map(p => this.project(p, obj));
                if (obj.tex && obj.tex.complete) {
                    this.drawTexturedTriangle(pts[0], pts[1], pts[2], 0, 0, obj.tex.width, 0, obj.tex.width, obj.tex.height, obj.tex);
                    this.drawTexturedTriangle(pts[0], pts[2], pts[3], 0, 0, obj.tex.width, obj.tex.height, 0, obj.tex.height, obj.tex);
                }
                return;
            }

            const pts = v.map(p => this.project(p, obj));
            faces.forEach((f, i) => {
                const p1 = pts[f[0]], p2 = pts[f[1]], p3 = pts[f[2]];
                
                const isVisible = (p2.x-p1.x)*(p3.y-p1.y) - (p2.y-p1.y)*(p3.x-p1.x) < 0;
                
                if (isVisible || obj.type === 'triangle') {
                    if (obj.tex && obj.tex.complete) {
                        const w = obj.tex.width;
                        const h = obj.tex.height;
                        
                        if (f.length === 4) {
                            const p4 = pts[f[3]];
                            this.drawTexturedTriangle(p1, p2, p3, 0, 0, w, 0, w, h, obj.tex);
                            this.drawTexturedTriangle(p1, p3, p4, 0, 0, w, h, 0, h, obj.tex);
                        } else if (f.length === 3) {
                            this.drawTexturedTriangle(p1, p2, p3, w/2, 0, w, h, 0, h, obj.tex);
                        }
                    } else {
                        this.ctx.beginPath();
                        f.forEach((idx, j) => j===0 ? this.ctx.moveTo(pts[idx].x, pts[idx].y) : this.ctx.lineTo(pts[idx].x, pts[idx].y));
                        this.ctx.closePath();
                        
                        const rgb = obj.col.split(',');
                        
                        let sh = 1.0; 
                        if (obj.type === 'sphere') sh = 0.8 + (i % 8) * 0.05;
                        else if (obj.type === 'cylinder') sh = 0.85 + (i % 10) * 0.04;
                        else sh = 0.85 + (i % faces.length * 0.05);
                        
                        sh = Math.min(1.0, sh);

                        this.ctx.fillStyle = `rgb(${Math.floor(rgb[0]*sh)},${Math.floor(rgb[1]*sh)},${Math.floor(rgb[2]*sh)})`;
                        this.ctx.fill();
                        
                        this.ctx.strokeStyle = `rgba(0,0,0,0.15)`;
                        this.ctx.stroke();
                    }
                }
            });
        });
    }
}
customElements.define('omm-model', OmmModel);