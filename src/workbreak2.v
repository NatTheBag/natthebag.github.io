module workbreak2 (
    input  wire CLK,
    input  wire SW1,
    input  wire SW2,
    input  wire SW3,
    input  wire SW4,
    
    output wire S1_A, S1_B, S1_C, S1_D, S1_E, S1_F, S1_G,
    output wire S2_A, S2_B, S2_C, S2_D, S2_E, S2_F, S2_G,
    
    output wire PMOD1, PMOD2, PMOD3, PMOD4, PMOD7, PMOD8, PMOD9, PMOD10,
    output wire LED1, LED2, LED3, LED4
);

    reg [24:0] clk_div = 25'd0;
    reg clk_1hz = 1'b0;
    always @(posedge CLK) begin
        if (clk_div == 25000000 - 1) begin
            clk_div <= 0;
            clk_1hz <= 1;
        end
        else begin
            clk_div <= clk_div + 1;
            clk_1hz <= 0;
        end
    end

    reg [14:0] tone_div = 15'd0;
    reg clk_1khz = 1'b0;
    always @(posedge CLK) begin
        if (tone_div == 12500 - 1) begin
            tone_div <= 0;
            clk_1khz <= ~clk_1khz;
        end
        else begin
            tone_div <= tone_div + 1;
        end
    end

    reg [17:0] deb_div = 18'd0;
    wire deb_tick = (deb_div == 250000 - 1);
    always @(posedge CLK) begin
        if (deb_tick) deb_div <= 0;
        else deb_div <= deb_div + 1;
    end

    reg [1:0] sp_sync = 2'b00;
    reg [1:0] sk_sync = 2'b00;
    reg [1:0] bk_sync = 2'b00;
    reg [1:0] pause_sync = 2'b00;
    always @(posedge CLK) begin
        if (deb_tick) begin
            sp_sync <= {sp_sync[0], SW1};
            sk_sync <= {sk_sync[0], SW3};
            bk_sync <= {bk_sync[0], SW2};
            pause_sync <= {pause_sync[0], SW4};
        end
    end

    reg sp_sync_d = 1'b0;
    reg sk_sync_d = 1'b0;
    reg bk_sync_d = 1'b0;
    reg pause_sync_d = 1'b0;
    always @(posedge CLK) begin
        sp_sync_d <= sp_sync[1];
        sk_sync_d <= sk_sync[1];
        bk_sync_d <= bk_sync[1];
        pause_sync_d <= pause_sync[1];
    end

    wire btn_work  = sp_sync[1] && !sp_sync_d;
    wire btn_5min  = sk_sync[1] && !sk_sync_d;
    wire btn_15min = bk_sync[1] && !bk_sync_d;
    wire btn_pause = pause_sync[1] && !pause_sync_d;

    localparam STATE_IDLE = 3'd0;
    localparam STATE_WORK = 3'd1;
    localparam STATE_PAUSED = 3'd2;
    localparam STATE_WORK_ALARM = 3'd3;
    localparam STATE_BREAK = 3'd4;
    localparam STATE_BREAK_ALARM = 3'd5;
    localparam STATE_LONG_BREAK = 3'd6;

    reg [5:0] minutes = 6'd25;
    reg [5:0] seconds = 6'd0;
    wire timer_en;
    wire load_break;
    wire buzzer_en;

    always @(posedge CLK) begin
        if (btn_work) begin
            minutes <= 6'd25;
            seconds <= 6'd0;
        end
        else if (btn_15min) begin
            minutes <= 6'd15;
            seconds <= 6'd0;
        end
        else if (btn_5min) begin
            minutes <= 6'd5;
            seconds <= 6'd0;
        end
        else if (load_work) begin
            minutes <= 6'd25;
            seconds <= 6'd0;
        end
        else if (load_break) begin
            if (next_state == STATE_LONG_BREAK) begin
                minutes <= 6'd15;
                seconds <= 6'd0;
            end
            else begin
                minutes <= 6'd5;
                seconds <= 6'd0;
            end
        end
        else if (timer_en && clk_1hz) begin
            if (seconds == 0) begin
                if (minutes != 0) begin
                    seconds <= 6'd59;
                    minutes <= minutes - 1;
                end
            end else begin
                seconds <= seconds - 1;
            end
        end
    end

    reg [2:0] current_state = STATE_IDLE;
    reg [2:0] next_state;
    reg [2:0] alarm_seconds = 3'd0;
    reg [1:0] work_cycles = 2'd0;
    reg [2:0] paused_from_state = STATE_IDLE;

    always @(posedge CLK) begin
        if (current_state != STATE_WORK_ALARM &&
                 current_state != STATE_BREAK_ALARM)
            alarm_seconds <= 0;
        else if (clk_1hz && alarm_seconds < 3'd5)
            alarm_seconds <= alarm_seconds + 1'b1;
    end

    always @(posedge CLK) begin
        if (btn_work)
            work_cycles <= 2'd0;
        else if (current_state == STATE_WORK_ALARM &&
                (next_state == STATE_BREAK || next_state == STATE_LONG_BREAK) &&
                (work_cycles < 2'd3))
            work_cycles <= work_cycles + 1'b1;
        else if (current_state == STATE_BREAK_ALARM &&
                next_state == STATE_WORK &&
                work_cycles == 2'd3)
            work_cycles <= 2'd0;
    end

    always @(posedge CLK) begin
        current_state <= next_state;
    end

    always @(posedge CLK) begin
        if (btn_pause &&
                (current_state == STATE_WORK ||
                current_state == STATE_BREAK ||
                current_state == STATE_LONG_BREAK))
            paused_from_state <= current_state;
    end

    always @(*) begin
        next_state = current_state;
        case(current_state)
            STATE_IDLE: begin
                if (btn_work)
                    next_state = STATE_WORK;
                else if (btn_5min)
                    next_state = STATE_BREAK;
                else if (btn_15min)
                    next_state = STATE_LONG_BREAK;
            end
            STATE_WORK: begin
                if (btn_work)
                    next_state = STATE_WORK;
                else if (btn_5min)
                    next_state = STATE_BREAK;
                else if (btn_15min)
                    next_state = STATE_LONG_BREAK;
                else if (btn_pause)
                    next_state = STATE_PAUSED;
                else if (minutes == 0 && seconds == 0 && clk_1hz)
                    next_state = STATE_WORK_ALARM;
            end
            STATE_PAUSED: begin
                if (btn_work)
                    next_state = STATE_WORK;
                else if (btn_5min)
                    next_state = STATE_BREAK;
                else if (btn_15min)
                    next_state = STATE_LONG_BREAK;
                else if (btn_pause)
                    next_state = paused_from_state;
            end
            STATE_WORK_ALARM: begin
                if (alarm_seconds >= 5) begin
                    if (work_cycles == 2'd3)
                        next_state = STATE_LONG_BREAK;
                    else
                        next_state = STATE_BREAK;
                end
            end
            STATE_BREAK: begin
                if (btn_work)
                    next_state = STATE_WORK;
                else if (btn_5min)
                    next_state = STATE_BREAK;
                else if (btn_15min)
                    next_state = STATE_LONG_BREAK;
                else if (btn_pause)
                    next_state = STATE_PAUSED;
                else if (minutes == 0 && seconds == 0 && clk_1hz)
                    next_state = STATE_BREAK_ALARM;
            end
            STATE_LONG_BREAK: begin
                if (btn_work)
                    next_state = STATE_WORK;
                else if (btn_5min)
                    next_state = STATE_BREAK;
                else if (btn_15min)
                    next_state = STATE_LONG_BREAK;
                else if (btn_pause)
                    next_state = STATE_PAUSED;
                else if (minutes == 0 && seconds == 0 && clk_1hz)
                    next_state = STATE_BREAK_ALARM;
            end
            STATE_BREAK_ALARM: begin
                if (alarm_seconds >= 5)
                    next_state = STATE_WORK;
            end
            default: next_state = STATE_IDLE;
        endcase
    end

    reg pause_blink = 1'b0;

    always @(posedge CLK) begin
        if (clk_1hz)
            pause_blink <= ~pause_blink;
    end

    wire is_paused = (current_state == STATE_PAUSED);
    assign LED1 = (current_state == STATE_IDLE);
    assign LED2 = (!is_paused && current_state == STATE_WORK && pause_blink) ||
                  (is_paused && paused_from_state == STATE_WORK);
    assign LED3 = (!is_paused &&
                  (current_state == STATE_BREAK ||
                   current_state == STATE_LONG_BREAK) &&
                   pause_blink) ||
                  (is_paused &&
                  (paused_from_state == STATE_BREAK ||
                   paused_from_state == STATE_LONG_BREAK));
    assign LED4 = (!is_paused &&
                  (current_state == STATE_WORK_ALARM ||
                   current_state == STATE_BREAK_ALARM));

    assign load_work = (current_state == STATE_BREAK_ALARM && next_state == STATE_WORK);
    assign load_break =
        (current_state == STATE_WORK_ALARM && 
        (next_state == STATE_BREAK || next_state == STATE_LONG_BREAK));
    assign timer_en =
        (current_state == STATE_WORK) ||
        (current_state == STATE_BREAK) ||
        (current_state == STATE_LONG_BREAK);
    assign buzzer_en =
        (current_state == STATE_WORK_ALARM) ||
        (current_state == STATE_BREAK_ALARM);

    wire [11:0] total_seconds = (minutes * 6'd60) + seconds;
    wire [11:0] total_time;
    assign total_time =
        (current_state == STATE_WORK ||
         (current_state == STATE_PAUSED &&
          paused_from_state == STATE_WORK)) ? 12'd1500 :
        (current_state == STATE_BREAK ||
         (current_state == STATE_PAUSED &&
          paused_from_state == STATE_BREAK)) ? 12'd300 :
        (current_state == STATE_LONG_BREAK ||
         (current_state == STATE_PAUSED &&
          paused_from_state == STATE_LONG_BREAK)) ? 12'd900 :
        12'd1500;

    wire [11:0] step;
    assign step = total_time / 12;

    wire [11:0] progress_pattern;
    assign progress_pattern[0]  = (total_seconds > step * 11);
    assign progress_pattern[1]  = (total_seconds > step * 10);
    assign progress_pattern[2]  = (total_seconds > step * 9);
    assign progress_pattern[3]  = (total_seconds > step * 8);
    assign progress_pattern[4]  = (total_seconds > step * 7);
    assign progress_pattern[5]  = (total_seconds > step * 6);
    assign progress_pattern[6]  = (total_seconds > step * 5);
    assign progress_pattern[7]  = (total_seconds > step * 4);
    assign progress_pattern[8]  = (total_seconds > step * 3);
    assign progress_pattern[9]  = (total_seconds > step * 2);
    assign progress_pattern[10] = (total_seconds > step);
    assign progress_pattern[11] = (total_seconds > 0);

    reg [21:0] alarm_led_div = 22'd0;
    reg [11:0] alarm_pattern = 12'b0000_0000_0111;

    always @(posedge CLK) begin
        if (!buzzer_en) begin
            alarm_led_div <= 22'd0;
            alarm_pattern <= 12'b0000_0000_0111;
        end
        else if (alarm_led_div == 22'd2499999) begin
            alarm_led_div <= 22'd0;
            alarm_pattern <= {alarm_pattern[10:0], alarm_pattern[11]};
        end
        else begin
            alarm_led_div <= alarm_led_div + 1'b1;
        end
    end

    wire [11:0] led_pattern = buzzer_en ? alarm_pattern : progress_pattern;
    wire [15:0] shift_word = {4'b0000, led_pattern};

    reg sr_data = 1'b0;
    reg sr_clock = 1'b0;
    reg sr_latch = 1'b0;
    reg [7:0] sr_div = 8'd0;
    reg sr_tick = 1'b0;
    reg [2:0] sr_state = 3'd0;
    reg [15:0] sr_buffer = 16'd0;
    reg [4:0] sr_bit_count = 5'd0;

    assign PMOD1 = sr_data;
    assign PMOD2 = sr_clock;
    assign PMOD3 = sr_latch;
    assign PMOD4 = 1'b0;
    assign PMOD7 = 1'b0;
    assign PMOD8 = 1'b0;
    assign PMOD9 = 1'b0;
    assign PMOD10 = buzzer_en ? clk_1khz : 1'b0;

    always @(posedge CLK) begin
        if (sr_div == 8'd249) begin
            sr_div <= 8'd0;
            sr_tick <= 1'b1;
        end
        else begin
            sr_div <= sr_div + 1'b1;
            sr_tick <= 1'b0;
        end
    end

    always @(posedge CLK) begin
        if (sr_tick) begin
            case (sr_state)
                3'd0: begin
                    sr_buffer <= shift_word;
                    sr_bit_count <= 5'd0;
                    sr_data <= 1'b0;
                    sr_clock <= 1'b0;
                    sr_latch <= 1'b0;
                    sr_state <= 3'd1;
                end
                3'd1: begin
                    sr_data <= sr_buffer[15];
                    sr_clock <= 1'b0;
                    sr_state <= 3'd2;
                end
                3'd2: begin
                    sr_clock <= 1'b1;
                    sr_state <= 3'd3;
                end
                3'd3: begin
                    sr_clock <= 1'b0;
                    sr_buffer <= sr_buffer << 1;
                    if (sr_bit_count == 5'd15)
                        sr_state <= 3'd4;
                    else begin
                        sr_bit_count <= sr_bit_count + 1'b1;
                        sr_state <= 3'd1;
                    end
                end
                3'd4: begin
                    sr_latch <= 1'b1;
                    sr_state <= 3'd5;
                end
                3'd5: begin
                    sr_latch <= 1'b0;
                    sr_state <= 3'd0;
                end
                default: sr_state <= 3'd0;
            endcase
        end
    end

    reg [5:0] display_value;
    reg [3:0] bcd_tens;
    reg [3:0] bcd_ones;
    always @(*) begin
        if (minutes > 0) begin
            if (seconds > 0)
                display_value = minutes + 1;
            else
                display_value = minutes;
        end
        else begin
            display_value = seconds;
        end
        bcd_tens = display_value / 10;
        bcd_ones = display_value % 10;
    end

    wire S1_out_A, S1_out_B, S1_out_C, S1_out_D, S1_out_E, S1_out_F, S1_out_G;
    wire S2_out_A, S2_out_B, S2_out_C, S2_out_D, S2_out_E, S2_out_F, S2_out_G;

    Binary_To_7Segment display_tens (
        .i_Clk(CLK),
        .i_Binary_Num(bcd_tens),
        .o_Segment_A(S1_out_A),
        .o_Segment_B(S1_out_B),
        .o_Segment_C(S1_out_C),
        .o_Segment_D(S1_out_D),
        .o_Segment_E(S1_out_E),
        .o_Segment_F(S1_out_F),
        .o_Segment_G(S1_out_G)
    );

    Binary_To_7Segment display_ones (
        .i_Clk(CLK),
        .i_Binary_Num(bcd_ones),
        .o_Segment_A(S2_out_A),
        .o_Segment_B(S2_out_B),
        .o_Segment_C(S2_out_C),
        .o_Segment_D(S2_out_D),
        .o_Segment_E(S2_out_E),
        .o_Segment_F(S2_out_F),
        .o_Segment_G(S2_out_G)
    );

    assign S1_A = ~S1_out_A;
    assign S1_B = ~S1_out_B;
    assign S1_C = ~S1_out_C;
    assign S1_D = ~S1_out_D;
    assign S1_E = ~S1_out_E;
    assign S1_F = ~S1_out_F;
    assign S1_G = ~S1_out_G;

    assign S2_A = ~S2_out_A;
    assign S2_B = ~S2_out_B;
    assign S2_C = ~S2_out_C;
    assign S2_D = ~S2_out_D;
    assign S2_E = ~S2_out_E;
    assign S2_F = ~S2_out_F;
    assign S2_G = ~S2_out_G;

endmodule

module Binary_To_7Segment (
    input        i_Clk,
    input  [3:0] i_Binary_Num,
    output       o_Segment_A,
    output       o_Segment_B,
    output       o_Segment_C,
    output       o_Segment_D,
    output       o_Segment_E,
    output       o_Segment_F,
    output       o_Segment_G
);

    reg [6:0] r_Hex_Encoding = 7'h00;

    always @(posedge i_Clk) begin
        case (i_Binary_Num)
            4'b0000 : r_Hex_Encoding <= 7'h7E;
            4'b0001 : r_Hex_Encoding <= 7'h30;
            4'b0010 : r_Hex_Encoding <= 7'h6D;
            4'b0011 : r_Hex_Encoding <= 7'h79;
            4'b0100 : r_Hex_Encoding <= 7'h33;          
            4'b0101 : r_Hex_Encoding <= 7'h5B;
            4'b0110 : r_Hex_Encoding <= 7'h5F;
            4'b0111 : r_Hex_Encoding <= 7'h70;
            4'b1000 : r_Hex_Encoding <= 7'h7F;
            4'b1001 : r_Hex_Encoding <= 7'h7B;
            4'b1010 : r_Hex_Encoding <= 7'h77;
            4'b1011 : r_Hex_Encoding <= 7'h1F;
            4'b1100 : r_Hex_Encoding <= 7'h4E;
            4'b1101 : r_Hex_Encoding <= 7'h3D;
            4'b1110 : r_Hex_Encoding <= 7'h4F;
            4'b1111 : r_Hex_Encoding <= 7'h47;
        endcase
    end

    assign o_Segment_A = r_Hex_Encoding[6];
    assign o_Segment_B = r_Hex_Encoding[5];
    assign o_Segment_C = r_Hex_Encoding[4];
    assign o_Segment_D = r_Hex_Encoding[3];
    assign o_Segment_E = r_Hex_Encoding[2];
    assign o_Segment_F = r_Hex_Encoding[1];
    assign o_Segment_G = r_Hex_Encoding[0];

endmodule