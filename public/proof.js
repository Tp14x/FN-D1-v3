(function() {
        // ---- Helper: format date to dd/mm/yyyy ----
        function formatDateToDMY(date) {
            if (!date) return '';
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }

        // ---- ใส่วันที่ปัจจุบันอัตโนมัติ (อ่านอย่างเดียว) ----
        const today = new Date();
        const todayDMY = formatDateToDMY(today);
        document.getElementById('orderDateDisplay').textContent = todayDMY;

        // ---- ชุดติดตั้ง: ถ้าว่างให้เป็น "FirstNews" ----
        const batchInput = document.getElementById('batch');
        batchInput.addEventListener('blur', function() {
            if (this.value.trim() === '') {
                this.value = 'FirstNews';
            }
        });
        batchInput.placeholder = 'FirstNews';

        // ---- Flatpickr สำหรับวันที่ ----
        const prodDateInput = document.getElementById('prodDate');
        flatpickr(prodDateInput, {
            dateFormat: 'd/m/Y',
            allowInput: true,
            placeholder: 'วัน/เดือน/ปี',
            defaultDate: today,
            locale: {
                firstDayOfWeek: 1,
                weekdays: {
                    shorthand: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
                    longhand: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
                },
                months: {
                    shorthand: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
                    longhand: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
                }
            }
        });

        const installDateInput = document.getElementById('installDate');
        flatpickr(installDateInput, {
            dateFormat: 'd/m/Y',
            allowInput: true,
            placeholder: 'วัน/เดือน/ปี',
            locale: {
                firstDayOfWeek: 1,
                weekdays: {
                    shorthand: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
                    longhand: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
                },
                months: {
                    shorthand: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
                    longhand: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
                }
            }
        });

        const installTimeInput = document.getElementById('installTime');
        flatpickr(installTimeInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: 'H:i',
            time_24hr: true,
            allowInput: true,
            placeholder: 'HH:MM',
            minuteIncrement: 1
        });

        const dismantleDateInput = document.getElementById('dismantleDate');
        flatpickr(dismantleDateInput, {
            dateFormat: 'd/m/Y',
            allowInput: true,
            placeholder: 'วัน/เดือน/ปี',
            locale: {
                firstDayOfWeek: 1,
                weekdays: {
                    shorthand: ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'],
                    longhand: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
                },
                months: {
                    shorthand: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
                    longhand: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
                }
            }
        });

        const dismantleTimeInput = document.getElementById('dismantleTime');
        flatpickr(dismantleTimeInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: 'H:i',
            time_24hr: true,
            allowInput: true,
            placeholder: 'HH:MM',
            minuteIncrement: 1,
            defaultHour: 0,
            defaultMinute: 0
        });

        // ---- จัดการรูปภาพ ----
        const dropArea = document.getElementById('imageDropArea');
        const fileInput = document.getElementById('fileInput');
        const placeholder = document.getElementById('imagePlaceholder');
        const previewContainer = document.getElementById('previewContainer');
        const previewImage = document.getElementById('previewImage');
        const removeBtn = document.getElementById('removeImageBtn');

        function showImage(src) {
            previewImage.src = src;
            previewContainer.style.display = 'flex';
            placeholder.style.display = 'none';
        }

        function hideImage() {
            previewContainer.style.display = 'none';
            placeholder.style.display = 'block';
            previewImage.src = '';
            fileInput.value = '';
        }

        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            hideImage();
        });

        dropArea.addEventListener('click', function(e) {
            if (e.target.closest('.remove-image-btn')) return;
            fileInput.click();
        });

        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    showImage(ev.target.result);
                };
                reader.readAsDataURL(file);
            } else if (file) {
                alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, GIF)');
                this.value = '';
            }
            this.value = '';
        });

        dropArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropArea.style.borderColor = '#1f8b4c';
            dropArea.style.background = '#f6fcf9';
        });
        dropArea.addEventListener('dragleave', function(e) {
            e.preventDefault();
            dropArea.style.borderColor = '#c5d0df';
            dropArea.style.background = '#fafcff';
        });
        dropArea.addEventListener('drop', function(e) {
            e.preventDefault();
            dropArea.style.borderColor = '#c5d0df';
            dropArea.style.background = '#fafcff';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    showImage(ev.target.result);
                };
                reader.readAsDataURL(file);
            } else if (file) {
                alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, GIF)');
            }
        });

        // ---- ตารางวัสดุ: เพิ่มแถว ----
        const materialBody = document.getElementById('materialBody');
        document.getElementById('addRowBtn').addEventListener('click', function() {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><input type="text" class="mat-name" placeholder=""></td>
                <td><input type="text" class="mat-size" placeholder=""></td>
                <td><input type="text" class="mat-qty" placeholder=""></td>
            `;
            materialBody.appendChild(tr);
        });

        // ---- ปุ่มพิมพ์ ----
        document.getElementById('printBtn').addEventListener('click', function() {
            const ae = document.getElementById('ae').value;
            const graphic = document.getElementById('graphic').value;
            const jobName = document.getElementById('jobName').value.trim();
            const customer = document.getElementById('customer').value.trim();

            if (!ae) {
                alert('⚠️ กรุณาเลือก AE');
                document.getElementById('ae').focus();
                return;
            }
            if (!graphic) {
                alert('⚠️ กรุณาเลือกกราฟฟิก');
                document.getElementById('graphic').focus();
                return;
            }
            if (!jobName) {
                alert('⚠️ กรุณากรอกชื่องาน');
                document.getElementById('jobName').focus();
                return;
            }
            if (!customer) {
                alert('⚠️ กรุณากรอกชื่อลูกค้า');
                document.getElementById('customer').focus();
                return;
            }

            const batch = document.getElementById('batch').value.trim() || 'FirstNews';
            document.getElementById('batch').value = batch;

            window.print();
        });

    })();
