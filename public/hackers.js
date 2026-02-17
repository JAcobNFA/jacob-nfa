(function() {
    let hc = document.getElementById('hacker-canvas');
    if (!hc) {
        hc = document.createElement('canvas');
        hc.id = 'hacker-canvas';
        document.body.insertBefore(hc, document.body.firstChild);
    }
    const hctx = hc.getContext('2d');

    function resizeHacker() {
        hc.width = window.innerWidth;
        hc.height = window.innerHeight;
    }
    resizeHacker();
    window.addEventListener('resize', resizeHacker);

    class Hacker {
        constructor() {
            this.reset();
        }
        reset(startVisible) {
            this.x = Math.random() * hc.width;
            this.y = hc.height * 0.1 + Math.random() * hc.height * 0.8;
            this.baseX = this.x;
            this.baseY = this.y;
            this.size = 60 + Math.random() * 55;
            this.dirX = (Math.random() - 0.5) * 0.6;
            this.drift = Math.random() * Math.PI * 2;
            this.driftSpeed = 0.01 + Math.random() * 0.015;
            this.maxAlpha = 0.7 + Math.random() * 0.3;
            this.fadeSpeed = 0.002 + Math.random() * 0.003;
            this.holdTime = 500 + Math.random() * 800;
            this.holdCounter = 0;
            this.glitchTimer = 0;
            this.glitchOffset = 0;
            if (startVisible) {
                this.alpha = this.maxAlpha * (0.5 + Math.random() * 0.5);
                this.phase = 'hold';
            } else {
                this.alpha = 0;
                this.phase = 'in';
            }
        }
        drawFigure(x, y, s, a) {
            hctx.save();
            hctx.globalAlpha = a;
            hctx.translate(x, y);

            const glowColor = 'rgba(240, 185, 11, 0.5)';
            hctx.shadowColor = glowColor;
            hctx.shadowBlur = 30;
            hctx.strokeStyle = 'rgba(240, 185, 11, 0.25)';
            hctx.lineWidth = 1.5;
            hctx.fillStyle = 'rgba(8, 8, 18, 0.95)';

            hctx.beginPath();
            hctx.moveTo(-s * 0.55, -s * 0.4);
            hctx.quadraticCurveTo(-s * 0.6, -s * 1.0, 0, -s * 1.15);
            hctx.quadraticCurveTo(s * 0.6, -s * 1.0, s * 0.55, -s * 0.4);
            hctx.lineTo(s * 0.4, -s * 0.3);
            hctx.quadraticCurveTo(0, -s * 0.75, -s * 0.4, -s * 0.3);
            hctx.closePath();
            hctx.fill();
            hctx.stroke();

            hctx.beginPath();
            hctx.ellipse(0, -s * 0.6, s * 0.25, s * 0.25, 0, 0, Math.PI * 2);
            hctx.fill();
            hctx.stroke();

            hctx.beginPath();
            hctx.moveTo(-s * 0.28, -s * 0.35);
            hctx.lineTo(s * 0.28, -s * 0.35);
            hctx.lineTo(s * 0.2, s * 0.35);
            hctx.quadraticCurveTo(0, s * 0.5, -s * 0.2, s * 0.35);
            hctx.closePath();
            hctx.fill();
            hctx.stroke();

            hctx.beginPath();
            hctx.moveTo(-s * 0.28, -s * 0.15);
            hctx.quadraticCurveTo(-s * 0.7, s * 0.15, -s * 0.5, s * 0.55);
            hctx.lineTo(-s * 0.35, s * 0.5);
            hctx.quadraticCurveTo(-s * 0.5, s * 0.1, -s * 0.18, s * 0.0);
            hctx.closePath();
            hctx.fill();
            hctx.stroke();

            hctx.beginPath();
            hctx.moveTo(s * 0.28, -s * 0.15);
            hctx.quadraticCurveTo(s * 0.7, s * 0.15, s * 0.5, s * 0.55);
            hctx.lineTo(s * 0.35, s * 0.5);
            hctx.quadraticCurveTo(s * 0.5, s * 0.1, s * 0.18, s * 0.0);
            hctx.closePath();
            hctx.fill();
            hctx.stroke();

            hctx.shadowColor = 'rgba(240, 185, 11, 0.9)';
            hctx.shadowBlur = 15;
            hctx.fillStyle = 'rgba(240, 185, 11, 0.7)';
            hctx.beginPath();
            hctx.ellipse(-s * 0.08, -s * 0.62, s * 0.045, s * 0.03, 0, 0, Math.PI * 2);
            hctx.fill();
            hctx.beginPath();
            hctx.ellipse(s * 0.08, -s * 0.62, s * 0.045, s * 0.03, 0, 0, Math.PI * 2);
            hctx.fill();

            hctx.shadowBlur = 25;
            hctx.fillStyle = 'rgba(240, 185, 11, 0.3)';
            hctx.beginPath();
            hctx.ellipse(-s * 0.08, -s * 0.62, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
            hctx.fill();
            hctx.beginPath();
            hctx.ellipse(s * 0.08, -s * 0.62, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
            hctx.fill();

            hctx.restore();
        }
        update() {
            this.drift += this.driftSpeed;
            this.x = this.baseX + Math.sin(this.drift) * 40;
            this.y = this.baseY + Math.cos(this.drift * 0.7) * 15;
            this.baseX += this.dirX;

            if (this.baseX < -80 || this.baseX > hc.width + 80) {
                this.dirX *= -1;
            }

            this.glitchTimer++;
            if (this.glitchTimer > 100 + Math.random() * 150) {
                this.glitchOffset = (Math.random() - 0.5) * 10;
                this.glitchTimer = 0;
                setTimeout(() => { this.glitchOffset = 0; }, 100);
            }

            if (this.phase === 'in') {
                this.alpha += this.fadeSpeed;
                if (this.alpha >= this.maxAlpha) {
                    this.alpha = this.maxAlpha;
                    this.phase = 'hold';
                }
            } else if (this.phase === 'hold') {
                this.holdCounter++;
                if (this.holdCounter >= this.holdTime) {
                    this.phase = 'out';
                }
            } else if (this.phase === 'out') {
                this.alpha -= this.fadeSpeed;
                if (this.alpha <= 0) {
                    this.alpha = 0;
                    this.reset(false);
                }
            }
        }
        draw() {
            if (this.alpha <= 0) return;
            this.drawFigure(this.x + this.glitchOffset, this.y, this.size, this.alpha);
            if (Math.abs(this.glitchOffset) > 3) {
                this.drawFigure(this.x - this.glitchOffset * 2, this.y, this.size, this.alpha * 0.3);
            }
        }
    }

    const hackers = [];
    const hackerCount = 8;
    for (let i = 0; i < hackerCount; i++) {
        const h = new Hacker();
        h.reset(true);
        h.drift = (i / hackerCount) * Math.PI * 2;
        h.baseX = (hc.width / (hackerCount + 1)) * (i + 1);
        h.x = h.baseX;
        hackers.push(h);
    }

    function animateHackers() {
        hctx.clearRect(0, 0, hc.width, hc.height);
        hackers.forEach(h => { h.update(); h.draw(); });
        requestAnimationFrame(animateHackers);
    }
    animateHackers();
})();
